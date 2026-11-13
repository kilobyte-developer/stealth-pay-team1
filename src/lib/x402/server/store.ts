import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Address, Hex } from "viem";
import type { PaymentRequirements } from "@x402/core/types";
import type { X402PaymentStatus } from "../config";

/**
 * Persisted state of one x402 stealth payment.
 *
 * Holds PUBLIC data only: addresses, the ephemeral PUBLIC key, amounts, tx
 * hashes and the relayer's already-signed announcement transaction (which is
 * broadcast publicly anyway). No private key, viewing key, spending key or
 * ephemeral private key is ever stored — the backend never has any of them.
 */
export interface X402PaymentRecord {
  /** The one-time stealth address (checksummed). Unique per payment. */
  id: Address;
  status: X402PaymentStatus;
  network: string;
  chainId: number;
  asset: Address;
  amount: string;
  stealthAddress: Address;
  ephemeralPublicKey: Hex;
  viewTag: Hex;
  schemeId: number;
  /** The exact requirements issued in the 402 response. */
  requirements: PaymentRequirements;
  /** Block height when the requirement was first issued (reconciliation lower bound). */
  createdAtBlock: string;
  createdAt: string;
  updatedAt: string;

  /** Set once an authorization has been verified. */
  authorization?: {
    payer: Address;
    nonce: Hex;
    validBefore: string;
  };

  /** Set once the transfer is confirmed on-chain. */
  settlement?: {
    txHash: Hex;
    blockNumber: string;
  };

  /**
   * The relayer's announcement transaction. Persisted BEFORE broadcast so a
   * crash or retry can rebroadcast the identical transaction (same nonce,
   * same hash) instead of sending a second announcement.
   */
  announcement?: {
    txHash: Hex;
    rawTransaction: Hex;
    nonce: number;
    blockNumber?: string;
  };

  /**
   * Receiver withdrawals out of this stealth address, relayed through the
   * facilitator (EIP-3009 signed locally by the one-time key — the key itself
   * never reaches the backend).
   */
  withdrawals?: {
    txHash: Hex;
    to: Address;
    amount: string;
    blockNumber: string;
  }[];

  /** Last error, for display and diagnostics. Never contains secrets. */
  lastError?: string;
}

export interface PaymentStore {
  get(id: Address): Promise<X402PaymentRecord | null>;
  put(record: X402PaymentRecord): Promise<void>;
}

/** Process-local store. Used by tests. */
export class MemoryPaymentStore implements PaymentStore {
  private readonly records = new Map<string, X402PaymentRecord>();

  async get(id: Address) {
    const r = this.records.get(id.toLowerCase());
    return r ? structuredClone(r) : null;
  }

  async put(record: X402PaymentRecord) {
    this.records.set(record.id.toLowerCase(), structuredClone(record));
  }
}

/**
 * JSON-file store for a single Node.js server process.
 *
 * Writes go to a temp file then `rename`, which is atomic on the same volume,
 * so a crash mid-write never leaves a truncated file. All writes are
 * serialised through one promise chain.
 *
 * Not suitable for multiple server instances or ephemeral serverless disks —
 * swap in a database-backed `PaymentStore` for that.
 */
export class FilePaymentStore implements PaymentStore {
  private cache: Map<string, X402PaymentRecord> | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly path: string) {}

  private async load(): Promise<Map<string, X402PaymentRecord>> {
    if (this.cache) return this.cache;
    try {
      const raw = JSON.parse(await readFile(this.path, "utf8")) as Record<
        string,
        X402PaymentRecord
      >;
      this.cache = new Map(Object.entries(raw));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      this.cache = new Map();
    }
    return this.cache;
  }

  async get(id: Address) {
    const records = await this.load();
    const r = records.get(id.toLowerCase());
    return r ? structuredClone(r) : null;
  }

  put(record: X402PaymentRecord): Promise<void> {
    const next = this.chain.then(async () => {
      const records = await this.load();
      records.set(record.id.toLowerCase(), structuredClone(record));
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(Object.fromEntries(records), null, 2), "utf8");
      await rename(tmp, this.path);
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
}

/**
 * Per-key async mutex. Serialises every state transition of one payment so
 * two concurrent requests for the same stealth address can never both settle
 * or both announce.
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const k = key.toLowerCase();
    const previous = this.tails.get(k) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => (release = resolve));
    const tail = previous.then(() => current);
    this.tails.set(k, tail);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.tails.get(k) === tail) this.tails.delete(k);
    }
  }
}
