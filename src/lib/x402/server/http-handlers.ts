import { getAddress, isAddress, type Address } from "viem";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type { PaymentPayload } from "@x402/core/types";
import { IntentValidationError } from "../intent";
import { PaymentRejectedError } from "./eip3009";
import {
  FacilitatorUnavailableError,
  SettlementOutcomeUnknownError,
  X402NotReadyError,
  toPaymentView,
  type X402StealthPaymentService,
} from "./payment-service";

const NO_STORE = { "Cache-Control": "no-store" };

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Maps known failures to HTTP responses. Unknown errors become a generic 500;
 * only the error class name is logged, never request data or key material.
 */
function errorResponse(err: unknown): Response {
  if (err instanceof IntentValidationError) {
    return json(400, { error: err.code, message: err.message });
  }
  if (err instanceof PaymentRejectedError) {
    return json(err.httpStatus, { error: err.code, message: err.message });
  }
  if (err instanceof X402NotReadyError) {
    return json(503, { error: "x402_not_ready", message: `x402 backend checks failed: ${err.message}` });
  }
  if (err instanceof FacilitatorUnavailableError) {
    return json(503, {
      error: "facilitator_unavailable",
      message: `${err.message} Nothing was authorized or charged; you can try again.`,
    });
  }
  if (err instanceof SettlementOutcomeUnknownError) {
    return json(502, {
      error: "settlement_outcome_unknown",
      message: `${err.message} The payment stays pending until the chain shows it settled or the authorization expires. Check its status before retrying.`,
    });
  }
  if (err instanceof Error && err.name === "X402ConfigError") {
    return json(503, { error: "x402_not_configured", message: err.message });
  }
  console.error("[x402] unexpected error:", err instanceof Error ? err.name : typeof err);
  return json(500, { error: "internal_error", message: "Unexpected server error." });
}

function paymentHeader(request: Request): string | null {
  return request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT");
}

/**
 * POST /api/x402/stealth-payments — the x402-protected resource.
 *
 * Without a payment header: validates the intent and answers 402 with a
 * PAYMENT-REQUIRED header whose single requirement pays the stealth address.
 * With a PAYMENT-SIGNATURE header: verifies, settles, confirms and announces,
 * answering 200 with a PAYMENT-RESPONSE header.
 */
export async function handlePaymentRequest(
  request: Request,
  getService: () => X402StealthPaymentService,
): Promise<Response> {
  try {
    const service = getService();
    const header = paymentHeader(request);

    if (!header) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json(400, { error: "INVALID_BODY", message: "Request body must be JSON." });
      }
      const { record, paymentRequired } = await service.requestPayment(body, request.url);
      return json(
        402,
        { ...paymentRequired, paymentId: record.id, payment: toPaymentView(record) },
        { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired) },
      );
    }

    let payload: PaymentPayload;
    try {
      payload = decodePaymentSignatureHeader(header);
    } catch {
      return json(400, { error: "invalid_payment_header", message: "PAYMENT-SIGNATURE header is not valid x402." });
    }
    const payTo = payload?.accepted?.payTo;
    if (typeof payTo !== "string" || !isAddress(payTo, { strict: false })) {
      return json(400, { error: "invalid_payment_header", message: "Payment does not name a payTo address." });
    }
    const id = getAddress(payTo);

    try {
      const { record, settleResponse } = await service.submitPayment(id, payload);
      return json(
        200,
        { payment: toPaymentView(record) },
        { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settleResponse) },
      );
    } catch (err) {
      // x402: a payment that cannot be accepted answers 402 with requirements.
      if (err instanceof PaymentRejectedError && err.httpStatus === 402) {
        const record = await service.getPayment(id).catch(() => null);
        if (record) {
          const paymentRequired = service.buildPaymentRequired(record, {
            error: err.code,
            resourceUrl: request.url,
          });
          return json(
            402,
            { ...paymentRequired, message: err.message, paymentId: record.id, payment: toPaymentView(record) },
            { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired) },
          );
        }
      }
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/x402/withdrawals — relays a receiver's EIP-3009 withdrawal out of
 * a stealth address. The request carries only the authorization SIGNED by the
 * one-time key (PAYMENT-SIGNATURE header), never the key itself.
 */
export async function handleWithdrawal(
  request: Request,
  getService: () => X402StealthPaymentService,
): Promise<Response> {
  try {
    const header = paymentHeader(request);
    if (!header) {
      return json(400, { error: "invalid_withdrawal", message: "Missing PAYMENT-SIGNATURE header." });
    }
    let payload: PaymentPayload;
    try {
      payload = decodePaymentSignatureHeader(header);
    } catch {
      return json(400, { error: "invalid_withdrawal", message: "PAYMENT-SIGNATURE header is not valid x402." });
    }
    const result = await getService().relayWithdrawal(payload);
    return json(200, {
      withdrawal: {
        stealthAddress: result.record.stealthAddress,
        to: result.to,
        amount: result.amount,
        txHash: result.txHash,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function parseId(raw: string): Address | null {
  return isAddress(raw, { strict: false }) ? getAddress(raw) : null;
}

/** GET /api/x402/stealth-payments/:id — current state (reconciled with chain). */
export async function handleGetPayment(
  rawId: string,
  getService: () => X402StealthPaymentService,
): Promise<Response> {
  try {
    const id = parseId(rawId);
    if (!id) return json(400, { error: "invalid_id", message: "Payment id must be the stealth address." });
    const record = await getService().getPayment(id);
    if (!record) return json(404, { error: "unknown_payment", message: "Unknown payment." });
    return json(200, { payment: toPaymentView(record) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/x402/stealth-payments/:id/announce — idempotent announcement retry. */
export async function handleRetryAnnouncement(
  rawId: string,
  getService: () => X402StealthPaymentService,
): Promise<Response> {
  try {
    const id = parseId(rawId);
    if (!id) return json(400, { error: "invalid_id", message: "Payment id must be the stealth address." });
    const record = await getService().announce(id);
    return json(200, { payment: toPaymentView(record) });
  } catch (err) {
    return errorResponse(err);
  }
}
