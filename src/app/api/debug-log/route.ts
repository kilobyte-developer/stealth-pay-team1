import { NextResponse } from "next/server";
import { getDebugLogClient } from "@/lib/supabase/debug-log-client";
import { explorerTxUrl } from "@/lib/format";
import type { DebugLogEntry } from "@/lib/supabase/debug-log-entry";
import type { NetworkKey } from "@/types";

/**
 * ============================================================================
 * DEV-ONLY DEBUG LOG — NOT A SOURCE OF TRUTH FOR PAYMENTS.
 *
 * This endpoint writes to a Supabase table that exists purely to help the
 * team check and debug transactions while developing StealthPay — which
 * wallet sent what, to which address, during development. It is NOT used to
 * store any transaction record for the product itself, and must never be
 * treated as proof that a payment happened. Every real transaction already
 * lives on-chain; use the "View on explorer" link (also included in every
 * row this writes) to independently verify it there, not this table.
 *
 * Writes use the Supabase service role key (server-only — see
 * `src/lib/supabase/debug-log-client.ts`). If Supabase isn't configured,
 * this silently no-ops: logging is optional and must never block or affect
 * a real payment.
 * ============================================================================
 */

const NETWORK_KEYS: readonly NetworkKey[] = ["fuji", "mainnet"];

function isValidEntry(body: unknown): body is DebugLogEntry {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.txHash === "string" &&
    (b.kind === "send" || b.kind === "forward") &&
    typeof b.network === "string" &&
    NETWORK_KEYS.includes(b.network as NetworkKey) &&
    typeof b.from === "string" &&
    typeof b.to === "string" &&
    typeof b.assetSymbol === "string" &&
    typeof b.isNative === "boolean" &&
    (b.tokenContract === null || typeof b.tokenContract === "string") &&
    typeof b.amount === "string" &&
    typeof b.blockNumber === "string"
  );
}

export async function POST(request: Request) {
  const supabase = getDebugLogClient();
  if (!supabase) return NextResponse.json({ logged: false });

  const body: unknown = await request.json().catch(() => null);
  if (!isValidEntry(body)) {
    return NextResponse.json({ logged: false }, { status: 400 });
  }

  const { error } = await supabase.from("debug_transaction_log").insert({
    tx_hash: body.txHash,
    kind: body.kind,
    network: body.network,
    from_address: body.from,
    to_address: body.to,
    asset_symbol: body.assetSymbol,
    is_native: body.isNative,
    token_contract: body.tokenContract,
    amount: body.amount,
    block_number: body.blockNumber,
    explorer_url: explorerTxUrl(body.network, body.txHash),
  });

  if (error) {
    // Server-only diagnostics — never surfaced to the payment flow.
    console.error("[debug-log] Supabase insert failed:", error.message);
    return NextResponse.json({ logged: false }, { status: 500 });
  }

  return NextResponse.json({ logged: true });
}
