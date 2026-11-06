"use client";

import * as React from "react";
import { formatUnits, type Address } from "viem";
import { getPublicClient } from "@/lib/chain/client";
import { useActiveNetwork } from "@/providers/wallet-provider";

export interface NativeBalance {
  state: "idle" | "loading" | "ready" | "error";
  /** Raw wei. */
  value: bigint | null;
  /** Human-readable AVAX, e.g. "1.2345". */
  formatted: string | null;
  error: string | null;
  refresh: () => void;
}

interface Fetched {
  state: "loading" | "ready" | "error";
  value: bigint | null;
  error: string | null;
}

const INITIAL: Fetched = { state: "loading", value: null, error: null };

/**
 * Reads a real native AVAX balance from the chain.
 *
 * `eth_getBalance` against the public RPC — no wallet permission needed beyond
 * knowing the address.
 *
 * The "no address" case is DERIVED rather than written into state, so the
 * effect never has to synchronously reset anything on mount.
 */
export function useNativeBalance(
  address: Address | null,
  pollMs = 20_000,
): NativeBalance {
  const network = useActiveNetwork();
  const [fetched, setFetched] = React.useState<Fetched>(INITIAL);
  const [nonce, setNonce] = React.useState(0);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    if (!address) return;

    let cancelled = false;

    async function read() {
      try {
        const balance = await getPublicClient(network).getBalance({
          address: address!,
        });
        if (!cancelled) {
          setFetched({ state: "ready", value: balance, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setFetched({
            state: "error",
            value: null,
            error:
              err instanceof Error ? err.message : "Could not read balance.",
          });
        }
      }
    }

    void read();
    const timer = window.setInterval(read, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [address, network, pollMs, nonce]);

  // Without an address there is nothing to report — distinct from zero balance.
  if (!address) {
    return {
      state: "idle",
      value: null,
      formatted: null,
      error: null,
      refresh,
    };
  }

  return {
    state: fetched.state,
    value: fetched.value,
    formatted: fetched.value === null ? null : formatUnits(fetched.value, 18),
    error: fetched.error,
    refresh,
  };
}
