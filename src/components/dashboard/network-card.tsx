"use client";

import { CircleCheck, CircleX, LoaderCircle, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { DataList, DataRow } from "@/components/ui/mono";
import { NETWORKS } from "@/config/networks";
import { useRpcStatus } from "@/hooks/use-rpc-status";
import { useActiveNetwork, useWallet } from "@/providers/wallet-provider";
import { formatBlock, truncateMiddle } from "@/lib/format";

export function NetworkCard() {
  const networkKey = useActiveNetwork();
  const network = NETWORKS[networkKey];
  const rpc = useRpcStatus(networkKey);
  const { address, status, walletName } = useWallet();
  const connected = status === "connected" || status === "switching";

  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="border-ink bg-coral grid size-10 shrink-0 place-items-center border-2">
            <Snowflake className="size-5" aria-hidden="true" />
          </span>
          <div>
            <SectionLabel className="text-grey">Network</SectionLabel>
            <p className="font-display mt-1 text-sm font-bold">
              {network.name}
            </p>
          </div>
        </div>
        {network.testnet ? (
          <Badge tone="lime" size="sm">
            Testnet
          </Badge>
        ) : (
          <Badge tone="coral" size="sm">
            Mainnet
          </Badge>
        )}
      </div>

      <DataList className="mt-5">
        <DataRow label="Chain ID" mono>
          {network.chainId}
        </DataRow>

        <DataRow label="RPC status" mono={false}>
          {rpc.state === "checking" ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              Checking…
            </span>
          ) : rpc.state === "ok" ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge tone="lime" size="xs">
                <CircleCheck className="size-2.5" aria-hidden="true" />
                Reachable
              </Badge>
              <span className="font-mono text-xs">
                block {formatBlock(rpc.blockNumber ?? 0)} · {rpc.latencyMs}ms
              </span>
            </span>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge tone="coral" size="xs">
                <CircleX className="size-2.5" aria-hidden="true" />
                Unreachable
              </Badge>
              <span className="text-grey text-xs">{rpc.error}</span>
            </span>
          )}
        </DataRow>

        <DataRow label="Connected wallet" mono={false}>
          {connected && address ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">
                {truncateMiddle(address, 10, 6)}
              </span>
              {walletName ? (
                <Badge tone="white" size="xs">
                  {walletName}
                </Badge>
              ) : null}
            </span>
          ) : (
            <span className="text-grey text-xs">Not connected</span>
          )}
        </DataRow>
      </DataList>

      <p className="border-ink bg-paper-2 mt-4 border-2 p-2.5 text-[0.7rem] leading-relaxed">
        Block height is read live from the public Avalanche RPC. Fuji is a test
        network — never send real assets to it.
      </p>
    </div>
  );
}
