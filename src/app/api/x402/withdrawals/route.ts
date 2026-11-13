import { getX402Service } from "@/lib/x402/server/env";
import { handleWithdrawal } from "@/lib/x402/server/http-handlers";

/** Gasless receiver withdrawal out of a stealth address, via the facilitator. */
export async function POST(request: Request) {
  return handleWithdrawal(request, getX402Service);
}
