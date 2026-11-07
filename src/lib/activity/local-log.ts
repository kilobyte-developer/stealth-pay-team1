import type { Address, Hex } from "viem";
import type { NetworkKey } from "@/types";

export type LocalActivityKind = "send" | "forward";

/**
 * A transaction this browser initiated (a send or a forward), recorded the
 * moment it confirms so it can appear in Activity alongside scanned incoming
 * payments. Incoming payments are discovered by scanning the chain and need
 * no local record; sends and forwards have no announcement-style on-chain
 * index to scan by "payments I sent", so this is the only way to list them.
 *
 * This is browser-local history, not a source of truth — it reflects what
 * THIS browser did, won't appear on another device, and is lost if site data
 * is cleared. Balances and payment detection never depend on it; it only
 * feeds the Activity list.
 *
 * Keyed by network only, not by address: this app supports one unlocked
 * identity per browser profile (one vault, no multi-identity switching), so
 * there is exactly one meaningful "whose activity is this" per browser
 * already, and forwarding works without a connected wallet at all (it signs
 * with the stealth key directly), so there is no wallet address to key by
 * for every entry.
 */
export interface LocalActivityEntry {
  /** The transaction hash — unique, and stable if the same entry is recorded twice. */
  id: Hex;
  kind: LocalActivityKind;
  network: NetworkKey;
  from: Address;
  to: Address;
  assetSymbol: string;
  assetDecimals: number;
  isNative: boolean;
  tokenContract: Address | null;
  /** Decimal string, as known at the time of the action. */
  amount: string;
  txHash: Hex;
  /** Serialized bigint (JSON can't hold a bigint directly). */
  blockNumber: string;
  /** ISO 8601, when this browser recorded the entry. */
  timestamp: string;
}

const STORAGE_PREFIX = "stealthpay:activity";
const MAX_ENTRIES = 200;

function storageKey(network: NetworkKey): string {
  return `${STORAGE_PREFIX}:${network}`;
}

/** Records a confirmed send or forward. Silently does nothing if storage is unavailable. */
export function recordLocalActivity(entry: LocalActivityEntry): void {
  try {
    const existing = getLocalActivity(entry.network);
    const next = [entry, ...existing.filter((e) => e.id !== entry.id)].slice(
      0,
      MAX_ENTRIES,
    );
    window.localStorage.setItem(storageKey(entry.network), JSON.stringify(next));
  } catch {
    // Private mode, blocked site data, or storage quota — the app still
    // works, it just won't remember this entry across reloads.
  }
}

export function getLocalActivity(network: NetworkKey): LocalActivityEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey(network));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalActivityEntry[]) : [];
  } catch {
    return [];
  }
}
