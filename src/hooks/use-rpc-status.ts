"use client";

import * as React from "react";
import { NETWORKS } from "@/config/networks";
import type { NetworkKey } from "@/types";

export interface RpcStatus {
  state: "checking" | "ok" | "error";
  blockNumber?: number;
  latencyMs?: number;
  error?: string;
}

/**
 * Polls the configured Avalanche RPC for the current block height.
 *
 * A plain JSON-RPC call requiring no wallet. Failures are surfaced rather than
 * hidden, so the panel never implies connectivity it does not have.
 */
export function useRpcStatus(
  network: NetworkKey,
  intervalMs = 30_000,
): RpcStatus {
  const [status, setStatus] = React.useState<RpcStatus>({ state: "checking" });

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function check() {
      const started = performance.now();
      try {
        const res = await fetch(NETWORKS[network].rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: [],
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: { result?: string; error?: { message?: string } } =
          await res.json();
        if (json.error) throw new Error(json.error.message ?? "RPC error");
        if (!json.result) throw new Error("Malformed RPC response");

        if (!cancelled) {
          setStatus({
            state: "ok",
            blockNumber: Number.parseInt(json.result, 16),
            latencyMs: Math.round(performance.now() - started),
          });
        }
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setStatus({
          state: "error",
          error: err instanceof Error ? err.message : "Unreachable",
        });
      }
    }

    void check();
    const timer = window.setInterval(check, intervalMs);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [network, intervalMs]);

  return status;
}
