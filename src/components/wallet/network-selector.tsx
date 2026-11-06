"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, LoaderCircle, Snowflake } from "lucide-react";
import { SUPPORTED_NETWORKS } from "@/config/networks";
import { useActiveNetwork, useWallet } from "@/providers/wallet-provider";
import { cn } from "@/lib/utils";

/**
 * Network control. While no wallet is connected this is an indicator of the
 * app's configured default rather than a switch — it never implies a chain
 * change the wallet has not actually performed.
 */
export function NetworkSelector({ className }: { className?: string }) {
  const { status, switchNetwork, unsupportedChain, chainId } = useWallet();
  const active = useActiveNetwork();
  const connected = status === "connected" || status === "switching";
  const current = SUPPORTED_NETWORKS.find((n) => n.key === active)!;

  const face = (
    <>
      {status === "switching" ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Snowflake className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="font-display text-[0.7rem] font-bold tracking-wide uppercase">
        {unsupportedChain ? `Chain ${chainId}` : current.shortName}
      </span>
    </>
  );

  const faceClasses = cn(
    "border-ink inline-flex h-9 items-center gap-2 border-2 px-2.5",
    unsupportedChain ? "bg-coral" : current.testnet ? "bg-lime" : "bg-white",
    className,
  );

  if (!connected) {
    return (
      <span
        className={faceClasses}
        title="Connect a wallet to switch networks. Fuji is the configured default."
      >
        {face}
      </span>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(faceClasses, "brutal-press shadow-brutal-xs hover:shadow-brutal-sm")}
      >
        {face}
        <ChevronDown className="size-3" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="border-ink shadow-brutal z-60 min-w-56 border-2 bg-white p-1"
        >
          {SUPPORTED_NETWORKS.map((n) => (
            <DropdownMenu.Item
              key={n.key}
              onSelect={() => void switchNetwork(n.key)}
              className="font-display flex cursor-pointer items-start gap-2 px-2.5 py-2 outline-none data-[highlighted]:bg-lime"
            >
              <span className="mt-0.5 size-3.5 shrink-0">
                {n.key === active && !unsupportedChain ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : null}
              </span>
              <span>
                <span className="block text-xs font-bold tracking-wide uppercase">
                  {n.shortName}
                </span>
                <span className="text-grey block font-mono text-[0.65rem] font-normal">
                  Chain ID {n.chainId}
                  {n.testnet ? " · testnet" : " · mainnet"}
                </span>
              </span>
            </DropdownMenu.Item>
          ))}
          <p className="text-grey border-ink/15 mt-1 border-t-2 px-2.5 py-2 text-[0.65rem] leading-relaxed">
            Fuji is the default for development and demos. Never use real
            assets while testing.
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
