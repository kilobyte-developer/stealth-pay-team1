import { formatUnits, getAddress } from "viem";
import { isX402Enabled } from "@/config/networks";
import { FUJI_USDC } from "@/lib/x402/config";
import type { DetectedPayment } from "@/lib/scanner/announcement-scanner";
import type { LocalActivityEntry } from "@/lib/activity/local-log";
import { truncateMiddle } from "@/lib/format";

/** Presentation shape for a detected payment. All values come from the chain. */
export interface PaymentRow {
  id: string;
  stealthAddress: string;
  /** The real payer, from the transaction's own `from` — not the announcer's `caller`. */
  from: string | null;
  assetLabel: string;
  /** What the announcement declared was sent. A claim by the announcer. */
  declaredAmount: string | null;
  /** What the address verifiably holds right now. */
  verifiedAmount: string;
  spendable: boolean;
  blockNumber: bigint;
  transactionHash: string;
  announcer: string;
  ephemeralPublicKey: string;
  viewTag: string;
  schemeId: number;
  isNative: boolean;
  token: string | null;
  /** Detection / withdrawal state, derived from the chain. */
  statusLabel: string;
  /** Received (proven on-chain) and since moved out: the address is empty. */
  forwarded: boolean;
  /** x402 only: the verified settlement tx (the announcement is `transactionHash`). */
  settlementTx: string | null;
}

function decimalsFor(payment: DetectedPayment): number {
  if (payment.assetKind === "native") return 18;
  // A token that does not expose `decimals` is shown in base units rather than
  // guessing 18 and displaying a wrong number.
  return payment.tokenDecimals ?? 0;
}

function assetLabelFor(payment: DetectedPayment): string {
  if (payment.assetKind === "native") return "AVAX";
  if (payment.tokenSymbol) return payment.tokenSymbol;
  return payment.token ? truncateMiddle(payment.token, 6, 4) : "Token";
}

/** An ERC-20 payment in the x402 (EIP-3009) asset, withdrawable gaslessly. */
function isX402AssetPayment(payment: DetectedPayment): boolean {
  return (
    isX402Enabled() &&
    payment.assetKind === "erc20" &&
    payment.token !== null &&
    getAddress(payment.token) === FUJI_USDC.address
  );
}

function trimTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

export function toPaymentRow(payment: DetectedPayment): PaymentRow {
  const decimals = decimalsFor(payment);

  return {
    id: payment.id,
    stealthAddress: payment.stealthAddress,
    from: payment.payerAddress,
    assetLabel: assetLabelFor(payment),
    declaredAmount:
      payment.announcedAmount === null
        ? null
        : trimTrailingZeros(formatUnits(payment.announcedAmount, decimals)),
    verifiedAmount: trimTrailingZeros(
      formatUnits(payment.verifiedBalance, decimals),
    ),
    // An ERC-20 balance cannot pay its own gas, so it is not spendable on its
    // own — the stealth account needs native AVAX first. The exception is the
    // x402 EIP-3009 asset: the one-time key signs an authorization and the
    // facilitator submits it, so no gas is needed at the stealth address.
    // Nothing left to move once the address is empty (forwarded).
    spendable:
      payment.verifiedBalance > 0n &&
      (payment.assetKind === "native" || isX402AssetPayment(payment)),
    forwarded: payment.verifiedBalance === 0n,
    statusLabel:
      payment.x402SettlementTx !== null
        ? payment.verifiedBalance > 0n
          ? "x402 · settled & announced"
          : "x402 · received, then withdrawn"
        : payment.verifiedBalance > 0n
          ? "Balance verified"
          : "Received · forwarded (balance now 0)",
    settlementTx: payment.x402SettlementTx,
    // For x402 the payment is the settlement; the announcement may be later.
    blockNumber: payment.x402SettlementBlock ?? payment.blockNumber,
    transactionHash: payment.transactionHash,
    announcer: payment.announcer,
    ephemeralPublicKey: payment.ephemeralPublicKey,
    viewTag: payment.viewTag,
    schemeId: payment.schemeId,
    isNative: payment.assetKind === "native",
    token: payment.token,
  };
}

/** Totals the verified native balance across detected payments, in wei. */
export function totalNativeWei(payments: DetectedPayment[]): bigint {
  return payments
    .filter((p) => p.assetKind === "native")
    .reduce((sum, p) => sum + p.verifiedBalance, 0n);
}

export function formatAvax(wei: bigint, maxDecimals = 4): string {
  const full = formatUnits(wei, 18);
  if (!full.includes(".")) return full;
  const [whole, frac] = full.split(".");
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/**
 * Every activity type the app can show, in one shape: a detected incoming
 * payment, a send this browser made, or a forward this browser made. From/to
 * are always present (or explicitly `null` when a lookup genuinely failed —
 * never fabricated) so the Activity list can show both for every row.
 */
export type ActivityDirection = "incoming" | "sent" | "forwarded";

export interface ActivityRow {
  id: string;
  direction: ActivityDirection;
  from: string | null;
  to: string;
  assetLabel: string;
  amount: string;
  /** `null` only for a local entry recorded before this field existed. */
  blockNumber: bigint | null;
  transactionHash: string;
  /** Only meaningful for incoming rows — a send/forward has already happened. */
  spendable: boolean | null;
  /** Human-readable state (e.g. "x402 · settled & announced"), when known. */
  statusLabel: string | null;
  /**
   * Incoming ↔ forward link: on an incoming row, the forward that spent it;
   * on a forward row, the incoming payment it spent. Set by `linkActivityRows`.
   */
  linkedTxHash: string | null;
  /** Present only for incoming rows; carries everything the detail dialog needs. */
  incoming: PaymentRow | null;
}

export function activityRowFromPayment(row: PaymentRow): ActivityRow {
  return {
    id: row.id,
    direction: "incoming",
    from: row.from,
    to: row.stealthAddress,
    assetLabel: row.assetLabel,
    // History shows what was RECEIVED. Once forwarded the balance is 0, and a
    // row is only kept then with on-chain proof of that amount (x402: the
    // settlement Transfer matched it; router: it wrote it atomically).
    amount: row.forwarded && row.declaredAmount !== null ? row.declaredAmount : row.verifiedAmount,
    blockNumber: row.blockNumber,
    // For x402, the settlement is the payment; the announcement came after.
    transactionHash: row.settlementTx ?? row.transactionHash,
    spendable: row.spendable,
    statusLabel: row.statusLabel,
    linkedTxHash: null,
    incoming: row,
  };
}

/**
 * Links each forward to the incoming payment it spent, by stealth address
 * (a forward's `from` is the stealth address an incoming row was paid `to`).
 * Pure; rows are otherwise returned unchanged, and nothing is dropped.
 */
export function linkActivityRows(rows: ActivityRow[]): ActivityRow[] {
  const key = (a: string | null) => (a ? a.toLowerCase() : "");
  const forwardsFrom = new Map<string, ActivityRow>();
  const incomingTo = new Map<string, ActivityRow>();
  for (const r of rows) {
    if (r.direction === "forwarded" && r.from && !forwardsFrom.has(key(r.from))) forwardsFrom.set(key(r.from), r);
    if (r.direction === "incoming" && !incomingTo.has(key(r.to))) incomingTo.set(key(r.to), r);
  }
  return rows.map((r) => {
    if (r.direction === "incoming") {
      const fw = forwardsFrom.get(key(r.to));
      if (!fw) return r;
      return {
        ...r,
        linkedTxHash: fw.transactionHash,
        statusLabel: `${r.statusLabel ?? "Received"} · forwarded in tx ${truncateMiddle(fw.transactionHash, 6, 4)}`,
      };
    }
    if (r.direction === "forwarded" && r.from) {
      const inc = incomingTo.get(key(r.from));
      if (!inc) return r;
      return {
        ...r,
        linkedTxHash: inc.transactionHash,
        statusLabel: `${r.statusLabel ?? "Forwarded"} · of payment to ${truncateMiddle(r.from, 6, 4)}`,
      };
    }
    return r;
  });
}

function localStatusLabel(entry: LocalActivityEntry): string | null {
  if (!entry.x402) return null;
  if (entry.kind === "forward") return "x402 · withdrawn (gasless)";
  return entry.x402.status === "announced"
    ? "x402 · settled & announced"
    : "x402 · settled, announcement pending";
}

export function activityRowFromLocalEntry(entry: LocalActivityEntry): ActivityRow {
  let blockNumber: bigint | null;
  try {
    // BigInt("") is 0n, not an error — treat an empty value as unknown.
    blockNumber = entry.blockNumber ? BigInt(entry.blockNumber) : null;
  } catch {
    blockNumber = null;
  }

  return {
    id: entry.id,
    direction: entry.kind === "send" ? "sent" : "forwarded",
    from: entry.from,
    to: entry.to,
    assetLabel: entry.assetSymbol,
    amount: trimTrailingZeros(entry.amount),
    blockNumber,
    transactionHash: entry.txHash,
    spendable: null,
    statusLabel: localStatusLabel(entry),
    linkedTxHash: null,
    incoming: null,
  };
}
