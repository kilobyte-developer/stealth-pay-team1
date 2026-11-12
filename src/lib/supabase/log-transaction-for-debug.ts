import type { DebugLogEntry } from "@/lib/supabase/debug-log-entry";

/**
 * Fire-and-forget: posts a confirmed transaction to the dev-only debug log
 * (see `src/app/api/debug-log/route.ts`). Never awaited by callers and never
 * throws — a failed or skipped (unconfigured) log must have zero effect on
 * the actual payment flow, which has already completed by the time this
 * runs. This is a debugging aid only, never a record of truth; the on-chain
 * transaction itself is what proves a payment happened.
 */
export function logTransactionForDebug(entry: DebugLogEntry): void {
  void fetch("/api/debug-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {
    /* Best-effort diagnostics only — see the docblock above. */
  });
}
