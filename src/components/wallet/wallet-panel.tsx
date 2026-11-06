"use client";

import * as React from "react";
import { Power, TriangleAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ConnectDialog } from "@/components/wallet/connect-dialog";
import { NetworkSelector } from "@/components/wallet/network-selector";
import { useWallet } from "@/providers/wallet-provider";
import { truncateMiddle } from "@/lib/format";

/** Connected-wallet summary used at the foot of the app sidebar. */
export function WalletPanel() {
  const { status, address, walletName, disconnect, unsupportedChain } =
    useWallet();
  const [open, setOpen] = React.useState(false);
  const connected = status === "connected" || status === "switching";

  return (
    <div className="space-y-2.5">
      <NetworkSelector className="w-full justify-center" />

      {connected && address ? (
        <div className="border-ink border-2 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
              {walletName ?? "Wallet"}
            </p>
            <span
              className="bg-lime border-ink size-2.5 border-2"
              aria-hidden="true"
            />
          </div>

          <p className="mt-2 font-mono text-[0.7rem] break-all">
            {truncateMiddle(address, 12, 6)}
          </p>

          {unsupportedChain ? (
            <p className="border-ink bg-coral/30 mt-2.5 flex items-start gap-1.5 border-2 p-2 text-[0.65rem] leading-relaxed font-medium">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              Unsupported chain — switch to Fuji.
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <CopyButton
              value={address}
              what="Address"
              size="sm"
              variant="outline"
              iconOnly
            />
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={disconnect}
            >
              <Power className="size-3.5" aria-hidden="true" />
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button
            variant="dark"
            size="md"
            className="w-full"
            onClick={() => setOpen(true)}
            disabled={status === "connecting"}
          >
            <Wallet className="size-4" aria-hidden="true" />
            {status === "connecting" ? "Connecting" : "Connect Wallet"}
          </Button>
          <p className="text-grey text-[0.65rem] leading-relaxed">
            Needed to send payments and switch networks. Receiving works without
            one.
          </p>
          <ConnectDialog open={open} onOpenChange={setOpen} />
        </>
      )}

    </div>
  );
}
