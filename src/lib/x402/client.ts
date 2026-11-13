import { getAddress, type Address, type Hex } from "viem";
import { x402Client } from "@x402/core/client";
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements, SettleResponse } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { OneTimeStealthAddress } from "@/lib/stealth";
import {
  X402_ASSET_TRANSFER_METHOD,
  X402_MAX_AMOUNT,
  X402_MAX_TIMEOUT_SECONDS,
  X402_PAYMENTS_PATH,
  X402_SCHEME,
  X402_VERSION,
  type X402AssetConfig,
  type X402PaymentStatus,
} from "./config";
import type { StealthPaymentIntent } from "./intent";

/** Minimal signer: what MetaMask (via viem's WalletClient) provides. */
export interface X402Signer {
  address: Address;
  signTypedData(args: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<Hex>;
}

/** Public payment view returned by the backend. */
export interface X402PaymentView {
  id: Address;
  status: X402PaymentStatus;
  amount: string;
  stealthAddress: Address;
  payer: Address | null;
  settlementTx: Hex | null;
  settlementBlock: string | null;
  announcementTx: Hex | null;
  announcementRetryable: boolean;
  lastError: string | null;
}

export class X402ClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly payment: X402PaymentView | null = null,
  ) {
    super(message);
    this.name = "X402ClientError";
  }
}

export type X402ClientStage = "requesting" | "signing" | "settling";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function fail(body: Record<string, unknown>, fallback: string): never {
  throw new X402ClientError(
    typeof body.error === "string" ? body.error : "request_failed",
    typeof body.message === "string" ? body.message : fallback,
    (body.payment as X402PaymentView | undefined) ?? null,
  );
}

/**
 * Checks the backend's requirement against what the SENDER derived locally.
 * A compromised or buggy backend must not be able to redirect the payment,
 * change the amount/token/network, or switch the transfer method.
 */
export function assertRequirementMatchesIntent(
  req: PaymentRequirements,
  intent: StealthPaymentIntent,
  asset: X402AssetConfig,
  payer: Address,
): void {
  const problems: string[] = [];
  if (req.scheme !== X402_SCHEME) problems.push("scheme");
  if (req.network !== intent.network) problems.push("network");
  if (getAddress(req.asset) !== getAddress(asset.address)) problems.push("asset");
  if (req.amount !== intent.amount) problems.push("amount");
  if (getAddress(req.payTo) !== getAddress(intent.stealthAddress)) problems.push("payTo");
  if (getAddress(req.payTo) === getAddress(payer)) problems.push("payTo is the payer");
  if (req.extra?.name !== asset.eip712.name || req.extra?.version !== asset.eip712.version) {
    problems.push("EIP-712 domain");
  }
  const method = req.extra?.assetTransferMethod ?? X402_ASSET_TRANSFER_METHOD;
  if (method !== X402_ASSET_TRANSFER_METHOD) problems.push("transfer method (only EIP-3009)");
  if (problems.length > 0) {
    throw new X402ClientError(
      "requirement_mismatch",
      `The server's payment requirement does not match this payment (${problems.join(", ")}). Nothing was signed.`,
    );
  }
}

/**
 * Pays a one-time stealth address through x402 (`exact` scheme, EIP-3009).
 *
 * 1. POST the public intent → server answers 402 + PAYMENT-REQUIRED.
 * 2. Validate the requirement against the locally derived stealth address.
 * 3. Sign an EIP-3009 TransferWithAuthorization in the sender's wallet.
 * 4. Re-POST with PAYMENT-SIGNATURE → server verifies, settles, confirms,
 *    announces, and answers with PAYMENT-RESPONSE.
 *
 * Only public data is sent: no private key, ephemeral private key or
 * meta-address ever leaves this browser.
 */
export async function payStealthAddressViaX402({
  derived,
  amount,
  asset,
  network,
  signer,
  endpoint = X402_PAYMENTS_PATH,
  fetchImpl = fetch,
  onStage,
}: {
  derived: Pick<OneTimeStealthAddress, "stealthAddress" | "ephemeralPublicKey" | "viewTag" | "schemeId">;
  /** Token base units. */
  amount: bigint;
  asset: X402AssetConfig;
  network: string;
  signer: X402Signer;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  onStage?: (stage: X402ClientStage) => void;
}): Promise<{ payment: X402PaymentView; settlement: SettleResponse | null }> {
  if (amount <= 0n || amount > X402_MAX_AMOUNT) {
    throw new X402ClientError("invalid_amount", "Amount is out of range.");
  }
  const intent: StealthPaymentIntent = {
    network,
    asset: asset.address,
    amount: amount.toString(),
    stealthAddress: getAddress(derived.stealthAddress),
    ephemeralPublicKey: derived.ephemeralPublicKey,
    viewTag: derived.viewTag,
    schemeId: derived.schemeId,
  };
  const body = JSON.stringify(intent);

  // ---- 1. Ask for the requirement ----
  onStage?.("requesting");
  const first = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  if (first.status !== 402) fail(await readJson(first), `Unexpected response ${first.status}.`);

  const header = first.headers.get("PAYMENT-REQUIRED");
  let paymentRequired: PaymentRequired;
  try {
    paymentRequired = header
      ? decodePaymentRequiredHeader(header)
      : ((await readJson(first)) as unknown as PaymentRequired);
  } catch {
    throw new X402ClientError("invalid_payment_required", "The server sent an unreadable payment requirement.");
  }
  if (paymentRequired.x402Version !== X402_VERSION || paymentRequired.accepts?.length !== 1) {
    throw new X402ClientError("invalid_payment_required", "Unexpected x402 payment requirement.");
  }

  // ---- 2. Validate before signing anything ----
  assertRequirementMatchesIntent(paymentRequired.accepts[0], intent, asset, signer.address);

  // ---- 3. Sign EIP-3009 authorization with the sender's wallet ----
  onStage?.("signing");
  const client = new x402Client()
    .register(network as PaymentRequirements["network"], new ExactEvmScheme(signer))
    .setSpendControls({
      allowedAssets: [
        { network: network as PaymentRequirements["network"], asset: asset.address, maxAmountPerPayment: X402_MAX_AMOUNT.toString() },
      ],
    });
  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  // ---- 4. Submit for verification + settlement ----
  onStage?.("settling");
  const second = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(paymentPayload),
    },
    body,
  });
  const result = await readJson(second);
  if (second.status !== 200) fail(result, `Payment was not completed (HTTP ${second.status}).`);

  let settlement: SettleResponse | null = null;
  const responseHeader = second.headers.get("PAYMENT-RESPONSE");
  if (responseHeader) {
    try {
      settlement = decodePaymentResponseHeader(responseHeader);
    } catch {
      settlement = null;
    }
  }
  return { payment: result.payment as X402PaymentView, settlement };
}

/** Path of the gasless withdrawal relay. */
export const X402_WITHDRAWALS_PATH = "/api/x402/withdrawals";

/**
 * Withdraws `amount` of the x402 asset out of a stealth address.
 *
 * `stealthSigner` is the ONE-TIME account derived locally from the receiver's
 * keys. It signs an EIP-3009 TransferWithAuthorization here, in the browser;
 * only the signature is sent. The facilitator submits it, so the stealth
 * address needs no gas and the receiver's main wallet is never involved.
 */
export async function withdrawStealthTokenViaX402({
  stealthSigner,
  to,
  amount,
  asset,
  network,
  endpoint = X402_WITHDRAWALS_PATH,
  fetchImpl = fetch,
}: {
  stealthSigner: X402Signer;
  to: Address;
  amount: bigint;
  asset: X402AssetConfig;
  network: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ txHash: Hex; amount: string; to: Address }> {
  if (amount <= 0n) throw new X402ClientError("invalid_amount", "Nothing to withdraw.");
  if (getAddress(to) === getAddress(stealthSigner.address)) {
    throw new X402ClientError("invalid_destination", "Destination must differ from the stealth address.");
  }
  const requirement: PaymentRequirements = {
    scheme: X402_SCHEME,
    network: network as PaymentRequirements["network"],
    asset: asset.address,
    amount: amount.toString(),
    payTo: getAddress(to),
    maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
    extra: {
      name: asset.eip712.name,
      version: asset.eip712.version,
      assetTransferMethod: X402_ASSET_TRANSFER_METHOD,
    },
  };
  const client = new x402Client()
    .register(network as PaymentRequirements["network"], new ExactEvmScheme(stealthSigner))
    .setSpendControls({
      allowedAssets: [{ network: network as PaymentRequirements["network"], asset: asset.address }],
    });
  const paymentPayload = await client.createPaymentPayload({
    x402Version: X402_VERSION,
    resource: { url: endpoint, description: "StealthPay stealth-address withdrawal", mimeType: "application/json" },
    accepts: [requirement],
  });
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(paymentPayload) },
  });
  const body = await readJson(res);
  if (res.status !== 200) fail(body, `Withdrawal failed (HTTP ${res.status}).`);
  const w = body.withdrawal as { txHash: Hex; amount: string; to: Address };
  return { txHash: w.txHash, amount: w.amount, to: w.to };
}

/** Reads a payment's current state (reconciled with the chain by the backend). */
export async function getX402Payment(
  id: Address,
  fetchImpl: typeof fetch = fetch,
): Promise<X402PaymentView> {
  const res = await fetchImpl(`${X402_PAYMENTS_PATH}/${id}`, { cache: "no-store" });
  const body = await readJson(res);
  if (res.status !== 200) fail(body, `Status check failed (HTTP ${res.status}).`);
  return body.payment as X402PaymentView;
}

/** Retries the announcement of a settled payment. Safe to call repeatedly. */
export async function retryX402Announcement(
  id: Address,
  fetchImpl: typeof fetch = fetch,
): Promise<X402PaymentView> {
  const res = await fetchImpl(`${X402_PAYMENTS_PATH}/${id}/announce`, { method: "POST" });
  const body = await readJson(res);
  if (res.status !== 200) fail(body, `Announcement retry failed (HTTP ${res.status}).`);
  return body.payment as X402PaymentView;
}
