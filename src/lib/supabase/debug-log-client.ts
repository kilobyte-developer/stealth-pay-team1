import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ============================================================================
 * DEV-ONLY DEBUG DATABASE — SERVER-SIDE ONLY.
 *
 * This client exists purely so the team can inspect "which wallet sent what,
 * to which address" while developing and debugging StealthPay. It is NOT a
 * record of truth for any payment and must never be treated as one — every
 * real transaction already lives on-chain and is independently verifiable
 * via the "View on explorer" links shown throughout the app. This table is
 * not used to store any transaction record for the product itself; it only
 * helps catch problems while building the project.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser — this
 * module is imported only from `src/app/api/debug-log/route.ts`, a server
 * route. Never import it from a "use client" file.
 * ============================================================================
 */

let cached: SupabaseClient | null = null;
let attempted = false;

/** Returns null (not a throw) when unconfigured — debug logging is optional. */
export function getDebugLogClient(): SupabaseClient | null {
  if (attempted) return cached;
  attempted = true;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cached;
}
