import { NETWORKS } from "@/config/networks";
import type { NetworkKey } from "@/types";

/** Shorten a hash or address for display: 0x1234…cdef */
export function truncateMiddle(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** Trim trailing zeros from a decimal string without touching precision. */
export function trimDecimal(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "");
}

export function formatAmount(amount: string, maxFractionDigits = 4): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatBlock(block: number): string {
  return block.toLocaleString("en-US");
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Compact relative time ("4m ago"). Deterministic given both inputs so it can
 * be rendered without hydration drift when `now` is supplied.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Formats in UTC using explicit getters rather than `toLocaleString`, so the
 * output is identical on the server and in the browser. Locale/timezone-aware
 * formatting would otherwise cause hydration mismatches.
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())} UTC`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )}`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function explorerTxUrl(network: NetworkKey, hash: string): string {
  return `${NETWORKS[network].explorerUrl}/tx/${hash}`;
}

export function explorerAddressUrl(network: NetworkKey, address: string): string {
  return `${NETWORKS[network].explorerUrl}/address/${address}`;
}

export function explorerBlockUrl(network: NetworkKey, block: number): string {
  return `${NETWORKS[network].explorerUrl}/block/${block}`;
}
