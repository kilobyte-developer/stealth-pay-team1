import { formatUnits } from "viem";
import type { DetectedPayment } from "@/lib/scanner/announcement-scanner";
import { truncateMiddle } from "@/lib/format";

/** Presentation shape for a detected payment. All values come from the chain. */
export interface PaymentRow {
  id: string;
  stealthAddress: string;
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
