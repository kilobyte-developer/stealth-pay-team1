import { getX402Service } from "@/lib/x402/server/env";
import { handlePaymentRequest } from "@/lib/x402/server/http-handlers";

/**
 * x402-protected resource: a payment to a one-time ERC-5564 stealth address.
 * See src/lib/x402/server/http-handlers.ts for the protocol flow.
 */
export async function POST(request: Request) {
  return handlePaymentRequest(request, getX402Service);
}
