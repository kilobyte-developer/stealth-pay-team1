import "server-only";
import { join } from "node:path";
import { createPublicClient, http, isHex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { CONTRACTS, NETWORKS } from "@/config/networks";
import { getChain } from "@/lib/chain/client";
import { FUJI_USDC, X402_FUJI_CHAIN_ID, X402_FUJI_NETWORK, X402_PAYMENTS_PATH } from "../config";
import { X402StealthPaymentService } from "./payment-service";
import { FilePaymentStore } from "./store";

/**
 * Server-side configuration for the x402 integration.
 *
 * Required environment (server only — NEVER prefix with NEXT_PUBLIC_):
 *   X402_FACILITATOR_URL             x402 facilitator base URL (e.g. https://facilitator.payai.network)
 *   STEALTHPAY_RELAYER_PRIVATE_KEY   0x-prefixed key of a dedicated Fuji account
 *                                    holding a little AVAX; it ONLY sends
 *                                    Announcer.announce() and never holds tokens
 * Also required (already used by the frontend):
 *   NEXT_PUBLIC_FUJI_ANNOUNCER_ADDRESS
 * Optional:
 *   X402_FUJI_RPC_URL                defaults to the public Fuji RPC
 *   STEALTHPAY_X402_STORE_PATH       defaults to .stealthpay/x402-payments.json
 */
export class X402ConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`x402 payments are not configured. Missing or invalid: ${missing.join(", ")}.`);
    this.name = "X402ConfigError";
  }
}

let service: X402StealthPaymentService | null = null;

export function getX402Service(): X402StealthPaymentService {
  if (service) return service;

  const missing: string[] = [];
  const facilitatorUrl = process.env.X402_FACILITATOR_URL?.trim();
  if (!facilitatorUrl || !/^https?:\/\//.test(facilitatorUrl)) missing.push("X402_FACILITATOR_URL");

  const relayerKey = process.env.STEALTHPAY_RELAYER_PRIVATE_KEY?.trim();
  if (!relayerKey || !isHex(relayerKey) || relayerKey.length !== 66) {
    missing.push("STEALTHPAY_RELAYER_PRIVATE_KEY");
  }

  const announcer = CONTRACTS.fuji.announcer;
  if (!announcer) missing.push("NEXT_PUBLIC_FUJI_ANNOUNCER_ADDRESS");

  if (missing.length > 0) throw new X402ConfigError(missing);

  const client = createPublicClient({
    chain: getChain("fuji"),
    transport: http(process.env.X402_FUJI_RPC_URL?.trim() || NETWORKS.fuji.rpcUrl, {
      retryCount: 2,
    }),
  }) as PublicClient;

  service = new X402StealthPaymentService({
    client,
    facilitator: new HTTPFacilitatorClient({ url: facilitatorUrl!, timeoutMs: 60_000 }),
    // The key is converted to a signer here and never stored, logged or returned.
    relayer: privateKeyToAccount(relayerKey as `0x${string}`),
    announcer: announcer!,
    asset: FUJI_USDC,
    network: X402_FUJI_NETWORK,
    chainId: X402_FUJI_CHAIN_ID,
    store: new FilePaymentStore(
      process.env.STEALTHPAY_X402_STORE_PATH?.trim() ||
        join(process.cwd(), ".stealthpay", "x402-payments.json"),
    ),
    resourceUrl: X402_PAYMENTS_PATH,
  });
  return service;
}
