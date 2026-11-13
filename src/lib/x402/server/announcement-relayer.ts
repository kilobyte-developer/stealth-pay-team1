import {
  BaseError,
  encodeFunctionData,
  formatEther,
  getAddress,
  keccak256,
  parseEventLogs,
  parseTransaction,
  type Address,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { ERC5564AnnouncerAbi } from "@/config/abi";
import { ANNOUNCEMENT_EVENT } from "@/lib/scanner/announcement-event";
import { encodeX402AnnouncementMetadata } from "../config";
import type { X402PaymentRecord } from "./store";

export interface AnnouncementContext {
  client: PublicClient;
  /** Relayer account. Signs locally; the key is never logged or returned. */
  relayer: LocalAccount;
  announcer: Address;
  chainId: number;
  /** Persists the record. Called before broadcast so retries are idempotent. */
  persist: (record: X402PaymentRecord) => Promise<void>;
  receiptTimeoutMs?: number;
}

export function announcementMetadataFor(record: X402PaymentRecord): Hex {
  return encodeX402AnnouncementMetadata(record.viewTag, record.asset, BigInt(record.amount));
}

/** True when the receipt contains THIS payment's announcement from the relayer. */
function receiptHasAnnouncement(
  receipt: TransactionReceipt,
  ctx: AnnouncementContext,
  record: X402PaymentRecord,
): boolean {
  if (receipt.status !== "success") return false;
  const events = parseEventLogs({
    abi: [ANNOUNCEMENT_EVENT],
    logs: receipt.logs.filter((l) => getAddress(l.address) === getAddress(ctx.announcer)),
  });
  const metadata = announcementMetadataFor(record).toLowerCase();
  return events.some(
    (e) =>
      e.args.schemeId === BigInt(record.schemeId) &&
      getAddress(e.args.stealthAddress) === record.stealthAddress &&
      getAddress(e.args.caller) === ctx.relayer.address &&
      e.args.ephemeralPubKey.toLowerCase() === record.ephemeralPublicKey.toLowerCase() &&
      e.args.metadata.toLowerCase() === metadata,
  );
}

async function tryGetReceipt(client: PublicClient, hash: Hex) {
  try {
    return await client.getTransactionReceipt({ hash });
  } catch {
    return null;
  }
}

/**
 * Looks for an existing announcement of this payment by the relayer, from
 * the settlement block onward. Guards against announcing twice even if the
 * stored tx hash was lost.
 */
async function findExistingAnnouncement(
  ctx: AnnouncementContext,
  record: X402PaymentRecord,
): Promise<{ txHash: Hex; blockNumber: bigint } | null> {
  const fromBlock = BigInt(record.settlement?.blockNumber ?? record.createdAtBlock);
  // cacheTime 0: viem otherwise serves a head up to ~4s stale, which would
  // stop the search before the block that holds the announcement.
  const head = await ctx.client.getBlockNumber({ cacheTime: 0 });
  const metadata = announcementMetadataFor(record).toLowerCase();
  // Avalanche's public RPC caps eth_getLogs at 100 blocks; start there and
  // still shrink if a different RPC enforces less.
  let chunk = 100n;
  let cursor = fromBlock;
  while (cursor <= head) {
    const to = cursor + chunk - 1n > head ? head : cursor + chunk - 1n;
    try {
      const logs = await ctx.client.getLogs({
        address: ctx.announcer,
        event: ANNOUNCEMENT_EVENT,
        args: {
          schemeId: BigInt(record.schemeId),
          stealthAddress: record.stealthAddress,
          caller: ctx.relayer.address,
        },
        fromBlock: cursor,
        toBlock: to,
      });
      const hit = logs.find(
        (l) =>
          l.args.ephemeralPubKey?.toLowerCase() === record.ephemeralPublicKey.toLowerCase() &&
          l.args.metadata?.toLowerCase() === metadata,
      );
      if (hit) return { txHash: hit.transactionHash, blockNumber: hit.blockNumber };
      cursor = to + 1n;
    } catch (err) {
      if (chunk <= 32n) throw err;
      chunk = chunk / 4n;
    }
  }
  return null;
}

/** The relayer cannot pay the announcement's gas. Actionable; never a secret. */
export class RelayerUnderfundedError extends Error {
  constructor(relayer: Address, balance: bigint, needed: bigint) {
    super(
      `Announcement relayer ${relayer} has ${formatEther(balance)} AVAX but needs at least ${formatEther(needed)} AVAX for gas. Fund that address with test AVAX, then retry the announcement — the payment itself is already settled and is not repeated.`,
    );
    this.name = "RelayerUnderfundedError";
  }
}

async function assertRelayerCanPay(ctx: AnnouncementContext, gas: bigint, maxFeePerGas: bigint) {
  const needed = gas * maxFeePerGas;
  const balance = await ctx.client.getBalance({ address: ctx.relayer.address });
  if (balance < needed) throw new RelayerUnderfundedError(ctx.relayer.address, balance, needed);
}

/** "Already in the mempool" responses, which make a rebroadcast a harmless no-op. */
function isAlreadyKnownError(err: unknown): boolean {
  const text = err instanceof BaseError ? `${err.shortMessage} ${err.details}` : String(err);
  return /already known|known transaction|already imported|nonce too low/i.test(text);
}

/**
 * Signs the announce() call for `record` at `nonce`. When replacing an
 * earlier signature for the same nonce (`replacing`), fees are raised at
 * least 12.5% above it so nodes accept the replacement.
 */
async function signAnnouncement(
  ctx: AnnouncementContext,
  record: X402PaymentRecord,
  nonce: number,
  replacing?: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint },
): Promise<{ txHash: Hex; rawTransaction: Hex; nonce: number }> {
  const data = encodeFunctionData({
    abi: ERC5564AnnouncerAbi,
    functionName: "announce",
    args: [
      BigInt(record.schemeId),
      record.stealthAddress,
      record.ephemeralPublicKey,
      announcementMetadataFor(record),
    ],
  });
  const gasEstimate = await ctx.client.estimateGas({
    account: ctx.relayer.address,
    to: ctx.announcer,
    data,
  });
  const fees = await ctx.client.estimateFeesPerGas();
  const bump = (prev: bigint | undefined) => (prev ? (prev * 1125n) / 1000n + 1n : 0n);
  const maxPriorityFeePerGas = [fees.maxPriorityFeePerGas, bump(replacing?.maxPriorityFeePerGas)].reduce((a, b) => (a > b ? a : b));
  let maxFeePerGas = [fees.maxFeePerGas, bump(replacing?.maxFeePerGas)].reduce((a, b) => (a > b ? a : b));
  if (maxFeePerGas < maxPriorityFeePerGas) maxFeePerGas = maxPriorityFeePerGas;
  const rawTransaction = await ctx.relayer.signTransaction({
    type: "eip1559",
    chainId: ctx.chainId,
    to: ctx.announcer,
    data,
    value: 0n,
    nonce,
    gas: (gasEstimate * 12n) / 10n,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  return { txHash: keccak256(rawTransaction), rawTransaction, nonce };
}

/**
 * Publishes the ERC-5564 announcement for a SETTLED payment, exactly once.
 *
 * Idempotency, in order:
 *  1. A stored tx that mined successfully → done.
 *  2. A stored tx not yet mined whose nonce is still free → rebroadcast the
 *     identical signed bytes (same hash), never a second transaction.
 *  3. An announcement already on-chain from this relayer → adopt it.
 *  4. Otherwise sign a new tx, persist it, THEN broadcast.
 *
 * Throws if the payment is not settled. Never called before settlement.
 */
export async function announceSettledPayment(
  ctx: AnnouncementContext,
  input: X402PaymentRecord,
): Promise<X402PaymentRecord> {
  let record = structuredClone(input);
  if (record.status === "announced") return record;
  if (record.status !== "settled" || !record.settlement) {
    throw new Error("Refusing to announce a payment whose settlement is not confirmed.");
  }

  const timeout = ctx.receiptTimeoutMs ?? 90_000;

  const markAnnounced = async (txHash: Hex, blockNumber: bigint) => {
    record = {
      ...record,
      status: "announced",
      announcement: { ...(record.announcement ?? { rawTransaction: "0x", nonce: -1 }), txHash, blockNumber: blockNumber.toString() },
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    };
    await ctx.persist(record);
    return record;
  };

  // ---- 1 & 2: a previously signed announcement exists ----
  if (record.announcement) {
    const prior = record.announcement;
    const receipt = await tryGetReceipt(ctx.client, prior.txHash);
    if (receipt) {
      if (receiptHasAnnouncement(receipt, ctx, record)) {
        return markAnnounced(prior.txHash, receipt.blockNumber);
      }
      // Mined but reverted / wrong: safe to discard and sign a new one.
      record = { ...record, announcement: undefined };
    } else {
      const confirmedNonce = await ctx.client.getTransactionCount({
        address: ctx.relayer.address,
        blockTag: "latest",
      });
      if (confirmedNonce <= prior.nonce) {
        // Our nonce is still unused. Rebroadcast the same signed bytes — or,
        // if their fee cap is now below the base fee (they could never be
        // mined), re-sign with the SAME nonce at current fees. One nonce
        // means at most one announcement can ever land.
        let pending = prior;
        const stored = parseTransaction(prior.rawTransaction);
        const head = await ctx.client.getBlock({ blockTag: "latest" });
        if (
          head.baseFeePerGas != null &&
          stored.maxFeePerGas !== undefined &&
          stored.maxFeePerGas < head.baseFeePerGas
        ) {
          pending = await signAnnouncement(ctx, record, prior.nonce, stored);
          record = { ...record, announcement: pending, updatedAt: new Date().toISOString() };
          await ctx.persist(record);
        }
        const tx = parseTransaction(pending.rawTransaction);
        await assertRelayerCanPay(ctx, tx.gas ?? 0n, tx.maxFeePerGas ?? 0n);
        try {
          await ctx.client.sendRawTransaction({ serializedTransaction: pending.rawTransaction });
        } catch (err) {
          // Only "already in the pool" is benign; anything else is a real failure.
          if (!isAlreadyKnownError(err)) throw err;
        }
        const mined = await ctx.client.waitForTransactionReceipt({ hash: pending.txHash, timeout });
        if (receiptHasAnnouncement(mined, ctx, record)) {
          return markAnnounced(pending.txHash, mined.blockNumber);
        }
        record = { ...record, announcement: undefined };
      } else {
        // Nonce consumed without our tx mining (dropped/replaced). Fall through.
        record = { ...record, announcement: undefined };
      }
    }
  }

  // ---- 3: already announced on-chain (e.g. stored hash lost) ----
  const existing = await findExistingAnnouncement(ctx, record);
  if (existing) return markAnnounced(existing.txHash, existing.blockNumber);

  // ---- 4: sign, persist, broadcast ----
  const nonce = await ctx.client.getTransactionCount({
    address: ctx.relayer.address,
    blockTag: "pending",
  });
  const signed = await signAnnouncement(ctx, record, nonce);
  const signedTx = parseTransaction(signed.rawTransaction);
  // Fail with a clear, actionable message BEFORE broadcasting, instead of the
  // RPC's insufficient-funds rejection.
  await assertRelayerCanPay(ctx, signedTx.gas ?? 0n, signedTx.maxFeePerGas ?? 0n);
  const { txHash, rawTransaction } = signed;

  record = {
    ...record,
    announcement: signed,
    updatedAt: new Date().toISOString(),
  };
  await ctx.persist(record);

  await ctx.client.sendRawTransaction({ serializedTransaction: rawTransaction });
  const receipt = await ctx.client.waitForTransactionReceipt({ hash: txHash, timeout });
  if (!receiptHasAnnouncement(receipt, ctx, record)) {
    throw new Error(`Announcement transaction ${txHash} did not emit the expected Announcement.`);
  }
  return markAnnounced(txHash, receipt.blockNumber);
}
