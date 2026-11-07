import { erc20Abi, type Address, type Hex } from "viem";
import { getPublicClient } from "@/lib/chain/client";
import { NETWORKS } from "@/config/networks";
import { parseAnnouncementMetadata } from "./metadata";
import { ANNOUNCEMENT_EVENT } from "./announcement-event";
import { decodeExplorerLog, fetchAnnouncementsViaExplorerApi } from "./explorer-api";
import type { NetworkKey } from "@/types";
import type { StealthCheckResult } from "@/lib/stealth";

export { ANNOUNCEMENT_EVENT };

/**
 * The exact log shape `client.getLogs({ event: ANNOUNCEMENT_EVENT })` returns,
 * extracted from the real call rather than hand-written, so it can never
 * drift out of sync with what viem actually produces. Never called — only
 * used for its type. Shared with `explorer-api.ts` (as a type-only import,
 * which erases at compile time and so cannot create a circular *runtime*
 * import) so a decoded explorer-API log can be fed into the same processing
 * code as an RPC-sourced one.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used only as a type, via ReturnType below
function _logShape(client: ReturnType<typeof getPublicClient>) {
  return client.getLogs({
    address: undefined as unknown as Address,
    event: ANNOUNCEMENT_EVENT,
    fromBlock: 0n,
    toBlock: 0n,
  });
}
export type AnnouncementLog = Awaited<ReturnType<typeof _logShape>>[number];

/** Blocks per `getLogs` request. Public RPCs reject very wide ranges. */
const DEFAULT_CHUNK = 2_000n;

/** Never shrink below this — if even one block errors, something else is wrong. */
const MIN_CHUNK = 1n;

/**
 * Walks an error's `cause` chain and joins every message, so the check below
 * sees the underlying JSON-RPC message even when viem has wrapped it in
 * several layers (HttpRequestError → RpcRequestError → the raw RPC error).
 */
function errorChainMessage(err: unknown, depth = 0): string {
  if (depth > 6 || err == null) return "";
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    return `${err.message} ${errorChainMessage(cause, depth + 1)}`;
  }
  return String(err);
}

/**
 * Different RPCs phrase their `eth_getLogs` range limit differently (Avalanche's
 * public endpoint: "exceeds the maximum of 100 blocks"; Alchemy/Infura-style:
 * "is limited to a 2000 range", etc). This matches the family of messages
 * rather than one provider's exact wording.
 */
function isRangeTooLargeError(err: unknown): boolean {
  const message = errorChainMessage(err).toLowerCase();
  return (
    message.includes("block range") ||
    (message.includes("range") && (message.includes("too large") || message.includes("exceed"))) ||
    message.includes("limited to a")
  );
}

/** Pulls a provider-stated limit out of its error message, when it states one. */
function extractStatedLimit(err: unknown): bigint | null {
  const message = errorChainMessage(err);
  const match =
    message.match(/maximum of (\d+)\s*blocks?/i) ??
    message.match(/limited to a (\d+)[\s-]*(?:range|blocks?)/i);
  if (!match) return null;
  try {
    const value = BigInt(match[1]);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

/** Retries for a transient failure (dropped connection, momentary RPC hiccup) before giving up. */
const TRANSIENT_RETRY_DELAYS_MS = [500, 1_500, 4_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AssetKind = "native" | "erc20";

export interface DetectedPayment {
  id: string;
  schemeId: number;
  stealthAddress: Address;
  /** The address that called `announce` — a router, not necessarily the payer. */
  announcer: Address;
  /**
   * The transaction's real sender — the actual payer. Fetched separately
   * from the log (the announcement itself doesn't carry it); `null` only if
   * that lookup failed, not a valid payer value.
   */
  payerAddress: Address | null;
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

  /**
   * Shared by both the explorer-API path and the RPC-chunked fallback, so
   * matching/verification logic exists in exactly one place regardless of
   * which source supplied the log.
   */
  async function processLog(log: AnnouncementLog) {
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
      return;
    }

    const parsed = parseAnnouncementMetadata(metadata);
    if (!parsed) return;

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
      return;
    }

    if (!result) return;
    if (result.reason !== "view-tag-mismatch") viewTagMatches += 1;
    if (!result.isForUser) return;

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
      return;
    }

    // Nothing held means nothing was received (or it has already been spent).
    if (verifiedBalance === 0n) return;

    // The announcement's `caller` is the router, not the payer — the real
    // payer is only visible as the transaction's own `from`, which needs a
    // separate lookup. Non-fatal if it fails: the payment itself is already
    // confirmed real by the balance check above.
    let payerAddress: Address | null = null;
    try {
      const tx = await client.getTransaction({ hash: log.transactionHash });
      payerAddress = tx.from;
    } catch {
      payerAddress = null;
    }

    payments.push({
      id: `${log.transactionHash}:${log.logIndex}`,
      schemeId: Number(schemeId),
      stealthAddress,
      announcer: caller,
      payerAddress,
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

  // ---- Primary path: one indexer-backed request for the whole range ----
  // Falls through to the chunked RPC walk below on ANY failure (network
  // error, unexpected response, or no explorerApiUrl configured for this
  // network) — this is a speed optimization, not a replacement; the proven
  // RPC path is always the fallback of record.
  const explorerApiUrl = NETWORKS[network].explorerApiUrl;
  if (explorerApiUrl && fromBlock <= headBlock) {
    try {
      const raw = await fetchAnnouncementsViaExplorerApi({
        apiUrl: explorerApiUrl,
        announcer,
        fromBlock,
        toBlock: headBlock,
        signal,
      });

      // `logIndex` from this API is unreliable (observed as the empty
      // string "0x" for every entry) — assign a synthetic one from the
      // result's own per-transaction order instead, so two announcements
      // in the same tx (e.g. an ERC-20 leg and its native gas top-up) don't
      // collide onto the same `DetectedPayment.id`.
      const perTxIndex = new Map<string, number>();
      for (const rawLog of raw) {
        if (signal?.aborted) break;
        const idx = perTxIndex.get(rawLog.transactionHash) ?? 0;
        perTxIndex.set(rawLog.transactionHash, idx + 1);
        const decoded = decodeExplorerLog(rawLog, idx);
        if (decoded) await processLog(decoded);
      }

      onProgress?.({
        fromBlock,
        toBlock: headBlock,
        headBlock,
        announcementsSeen,
        viewTagMatches,
        paymentsDetected: payments.length,
      });

      payments.sort((a, b) =>
        a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0,
      );

      return {
        payments,
        lastScannedBlock: headBlock,
        headBlock,
        announcementsSeen,
        viewTagMatches,
      };
    } catch {
      // Explorer API unavailable or erroring — reset any partial state and
      // fall through to the chunked RPC walk, the proven path.
      payments.length = 0;
      announcementsSeen = 0;
      viewTagMatches = 0;
    }
  }

  // ---- Fallback: chunked eth_getLogs, adaptive to the RPC's own range cap ----
  let cursor = fromBlock > headBlock ? headBlock : fromBlock;
  // Shrinks on demand when the RPC rejects a chunk as too wide, and stays
  // shrunk for the rest of the scan rather than re-discovering the limit
  // on every chunk.
  let currentChunk = chunkSize;

  /**
   * One window, with its own retry budget for transient failures (dropped
   * connection, momentary RPC hiccup — this public RPC does both). A
   * range-too-large error is NOT retried here: it needs a smaller window,
   * which only the caller can decide, so it's thrown straight through.
   */
  async function fetchWindow(from: bigint, to: bigint) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await client.getLogs({
          address: announcer,
          event: ANNOUNCEMENT_EVENT,
          fromBlock: from,
          toBlock: to,
        });
      } catch (err) {
        if (isRangeTooLargeError(err)) throw err;
        if (attempt >= TRANSIENT_RETRY_DELAYS_MS.length || signal?.aborted) {
          throw err;
        }
        await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  while (cursor <= headBlock) {
    if (signal?.aborted) break;

    const upper =
      cursor + currentChunk - 1n > headBlock ? headBlock : cursor + currentChunk - 1n;

    let logs;
    try {
      logs = await fetchWindow(cursor, upper);
    } catch (err) {
      if (!isRangeTooLargeError(err)) throw err;

      const stated = extractStatedLimit(err);
      const shrunk =
        stated !== null && stated < currentChunk ? stated : currentChunk / 2n;

      if (shrunk < MIN_CHUNK) throw err;

      currentChunk = shrunk;
      continue; // retry the same `cursor` with the smaller window
    }

    for (const log of logs) {
      if (signal?.aborted) break;
      await processLog(log);
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

  // Newest first: blocks are walked in ascending order above, but callers
  // (e.g. a "recent payments" list that just takes the first few) expect the
  // most recent payment first, not the oldest one found.
  payments.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0));

  return {
    payments,
    lastScannedBlock: cursor > headBlock ? headBlock : cursor,
    headBlock,
    announcementsSeen,
    viewTagMatches,
  };
}
