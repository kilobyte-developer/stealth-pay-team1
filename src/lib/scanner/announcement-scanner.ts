import { erc20Abi, parseAbiItem, type Address, type Hex } from "viem";
import { getPublicClient } from "@/lib/chain/client";
import { parseAnnouncementMetadata } from "./metadata";
import type { NetworkKey } from "@/types";
import type { StealthCheckResult } from "@/lib/stealth";

/**
 * The canonical ERC-5564 Announcement event, written out rather than imported
 * from generated artifacts so the scanner stays usable against ANY compliant
 * Announcer, not only the one this repo deploys.
 */
export const ANNOUNCEMENT_EVENT = parseAbiItem(
  "event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)",
);

/** Blocks per `getLogs` request. Public RPCs reject very wide ranges. */
const DEFAULT_CHUNK = 2_000n;

export type AssetKind = "native" | "erc20";

export interface DetectedPayment {
  id: string;
  schemeId: number;
  stealthAddress: Address;
  /** The address that called `announce` — a router, not necessarily the payer. */
  announcer: Address;
  ephemeralPublicKey: Hex;
  viewTag: Hex;
  assetKind: AssetKind;
  /** Token contract for ERC-20 payments. */
  token: Address | null;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  /** Amount the announcement declared. A claim, not proof. */
  announcedAmount: bigint | null;
  /** Balance actually held by the stealth address right now. Verified. */
  verifiedBalance: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: number;
}

export interface ScanProgress {
  fromBlock: bigint;
  toBlock: bigint;
  headBlock: bigint;
  announcementsSeen: number;
  viewTagMatches: number;
  paymentsDetected: number;
}

export interface ScanOptions {
  network: NetworkKey;
  announcer: Address;
  fromBlock: bigint;
  toBlock?: bigint;
  /**
   * Runs the ERC-5564 check. Supplied by the caller so the private viewing key
   * never leaves the provider that owns it — the scanner never sees a secret.
   */
  match: (input: {
    stealthAddress: Address;
    ephemeralPublicKey: Hex;
    viewTag: Hex;
    schemeId: number;
  }) => StealthCheckResult | null;
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
  chunkSize?: bigint;
}

export interface ScanResult {
  payments: DetectedPayment[];
  lastScannedBlock: bigint;
  headBlock: bigint;
  announcementsSeen: number;
  viewTagMatches: number;
}

const tokenMetaCache = new Map<string, { symbol: string | null; decimals: number | null }>();

async function readTokenMeta(network: NetworkKey, token: Address) {
  const key = `${network}:${token.toLowerCase()}`;
  const cached = tokenMetaCache.get(key);
  if (cached) return cached;

  const client = getPublicClient(network);
  let symbol: string | null = null;
  let decimals: number | null = null;

  // Non-standard tokens may omit either; neither is required to show a payment.
  try {
    symbol = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    });
  } catch {
    symbol = null;
  }
  try {
    decimals = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    });
  } catch {
    decimals = null;
  }

  const meta = { symbol, decimals };
  tokenMetaCache.set(key, meta);
  return meta;
}

/**
 * Scans ERC-5564 announcements and returns the payments that belong to this
 * receiver.
 *
 * Pipeline per announcement, mirroring PROJECT_FLOW §13–14:
 *   1. Read the log from the Announcer.
 *   2. Take the view tag from metadata byte 0 and run the cheap filter.
 *   3. Only on a tag hit, derive the candidate address and compare.
 *   4. **Verify the asset actually sits at that address.** An announcement is a
 *      permissionless claim — anyone can announce anything — so a match alone
 *      is never treated as a received payment.
 *
 * Only payments with a non-zero verified balance are returned.
 */
export async function scanAnnouncements(
  options: ScanOptions,
): Promise<ScanResult> {
  const {
    network,
    announcer,
    fromBlock,
    match,
    onProgress,
    signal,
    chunkSize = DEFAULT_CHUNK,
  } = options;

  const client = getPublicClient(network);
  const headBlock = options.toBlock ?? (await client.getBlockNumber());

  const payments: DetectedPayment[] = [];
  let announcementsSeen = 0;
  let viewTagMatches = 0;
  let cursor = fromBlock > headBlock ? headBlock : fromBlock;

  while (cursor <= headBlock) {
    if (signal?.aborted) break;

    const upper =
      cursor + chunkSize - 1n > headBlock ? headBlock : cursor + chunkSize - 1n;

    const logs = await client.getLogs({
      address: announcer,
      event: ANNOUNCEMENT_EVENT,
      fromBlock: cursor,
      toBlock: upper,
    });

    for (const log of logs) {
      if (signal?.aborted) break;
      announcementsSeen += 1;

      const { schemeId, stealthAddress, caller, ephemeralPubKey, metadata } =
        log.args as {
          schemeId?: bigint;
          stealthAddress?: Address;
          caller?: Address;
          ephemeralPubKey?: Hex;
          metadata?: Hex;
        };

      if (
        schemeId === undefined ||
        !stealthAddress ||
        !caller ||
        !ephemeralPubKey ||
        !metadata
      ) {
        continue;
      }

      const parsed = parseAnnouncementMetadata(metadata);
      if (!parsed) continue;

      // Malformed ephemeral keys are rejected by the engine; skip rather than
      // letting one bad announcement abort the whole scan.
      let result: StealthCheckResult | null = null;
      try {
        result = match({
          stealthAddress,
          ephemeralPublicKey: ephemeralPubKey,
          viewTag: parsed.viewTag,
          schemeId: Number(schemeId),
        });
      } catch {
        continue;
      }

      if (!result) continue;
      if (result.reason !== "view-tag-mismatch") viewTagMatches += 1;
      if (!result.isForUser) continue;

      // ---- Verify the funds are really there ----
      let verifiedBalance = 0n;
      let tokenSymbol: string | null = null;
      let tokenDecimals: number | null = null;

      try {
        if (parsed.kind === "erc20" && parsed.token) {
          verifiedBalance = await client.readContract({
            address: parsed.token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [stealthAddress],
          });
          const meta = await readTokenMeta(network, parsed.token);
          tokenSymbol = meta.symbol;
          tokenDecimals = meta.decimals;
        } else {
          verifiedBalance = await client.getBalance({
            address: stealthAddress,
          });
        }
      } catch {
        continue;
      }

      // Nothing held means nothing was received (or it has already been spent).
      if (verifiedBalance === 0n) continue;

      payments.push({
        id: `${log.transactionHash}:${log.logIndex}`,
        schemeId: Number(schemeId),
        stealthAddress,
        announcer: caller,
        ephemeralPublicKey: ephemeralPubKey,
        viewTag: parsed.viewTag,
        assetKind: parsed.kind === "erc20" ? "erc20" : "native",
        token: parsed.token,
        tokenSymbol,
        tokenDecimals,
        announcedAmount: parsed.amount,
        verifiedBalance,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      });
    }

    onProgress?.({
      fromBlock: cursor,
      toBlock: upper,
      headBlock,
      announcementsSeen,
      viewTagMatches,
      paymentsDetected: payments.length,
    });

    cursor = upper + 1n;
  }

  return {
    payments,
    lastScannedBlock: cursor > headBlock ? headBlock : cursor,
    headBlock,
    announcementsSeen,
    viewTagMatches,
  };
}
