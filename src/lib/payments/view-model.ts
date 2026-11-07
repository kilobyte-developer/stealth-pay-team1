import { formatUnits } from "viem";
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
    // own — the stealth account needs native AVAX first.
    spendable: payment.assetKind === "native",
    blockNumber: payment.blockNumber,
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
    amount: row.verifiedAmount,
    blockNumber: row.blockNumber,
    transactionHash: row.transactionHash,
    spendable: row.spendable,
    incoming: row,
  };
}

export function activityRowFromLocalEntry(entry: LocalActivityEntry): ActivityRow {
  let blockNumber: bigint | null;
  try {
    blockNumber = BigInt(entry.blockNumber);
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
    incoming: null,
  };
}
