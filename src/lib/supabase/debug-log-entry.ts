import type { Hex, NetworkKey } from "@/types";

/**
 * Payload shape for the dev-only debug log — see the warning in
 * `src/app/api/debug-log/route.ts`. Deliberately mirrors
 * `LocalActivityEntry` (`src/lib/activity/local-log.ts`) since both are
 * recorded from the same two call sites after a transaction confirms.
 */
export interface DebugLogEntry {
  txHash: Hex;
  kind: "send" | "forward";
  network: NetworkKey;
  from: Hex;
  to: Hex;
  assetSymbol: string;
  isNative: boolean;
  tokenContract: Hex | null;
  /** Decimal string, as known at the time of the action. */
  amount: string;
  blockNumber: string;
}
