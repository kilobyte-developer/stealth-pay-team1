"use client";

import * as React from "react";
import { CircleAlert, ExternalLink, LoaderCircle, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/providers/wallet-provider";

const WALLET_DOWNLOADS = [
  { name: "Core", href: "https://core.app/" },
  { name: "MetaMask", href: "https://metamask.io/download/" },
];

export function ConnectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { available, connect, status, error, clearError } = useWallet();
  const [pending, setPending] = React.useState<string | null>(null);

  async function handleConnect(uuid: string) {
    setPending(uuid);
    clearError();
    await connect(uuid);
    setPending(null);
  }

  // Close automatically once a connection is established.
  React.useEffect(() => {
    if (status === "connected" && open) onOpenChange(false);
  }, [status, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>
            StealthPay reads your address and network only. It never asks for
            private keys.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="border-ink bg-coral/25 mb-4 flex items-start gap-2.5 border-2 p-3">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-xs leading-relaxed font-medium">{error}</p>
          </div>
        ) : null}

        {available.length > 0 ? (
          <ul className="space-y-2">
            {available.map(({ info }) => {
              const busy = pending === info.uuid;
              return (
                <li key={info.uuid}>
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => handleConnect(info.uuid)}
                    className="brutal-press border-ink hover:bg-lime shadow-brutal-sm hover:shadow-brutal active:shadow-brutal-xs flex w-full items-center gap-3 border-2 bg-white p-3 text-left disabled:opacity-60"
                  >
                    {info.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URI supplied by the wallet extension
                      <img
                        src={info.icon}
                        alt=""
                        width={28}
                        height={28}
                        className="border-ink size-7 border-2 object-contain"
                      />
                    ) : (
                      <span className="border-ink inline-flex size-7 items-center justify-center border-2">
                        <Wallet className="size-3.5" aria-hidden="true" />
                      </span>
                    )}
                    <span className="font-display min-w-0 flex-1 truncate text-sm font-bold">
                      {info.name}
                    </span>
                    {busy ? (
                      <LoaderCircle
                        className="size-4 shrink-0 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-ink border-2 border-dashed p-5 text-center">
            <Wallet className="mx-auto size-7" aria-hidden="true" />
            <p className="font-display mt-3 text-sm font-bold">
              No injected wallet detected
            </p>
            <p className="text-grey mx-auto mt-1.5 max-w-xs text-xs leading-relaxed">
              This browser did not announce any EIP-6963 wallet. Install one of
              the following, then reopen this dialog.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {WALLET_DOWNLOADS.map((w) => (
                <a
                  key={w.name}
                  href={w.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display inline-flex items-center gap-1.5 border-2 bg-white px-3 py-1.5 text-xs font-bold uppercase"
                >
                  {w.name}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-grey mt-5 flex items-start gap-2 text-[0.7rem] leading-relaxed">
          <Badge tone="muted" size="xs" className="shrink-0">
            UI preview
          </Badge>
          <span>
            Connecting is a real wallet session. Balances and payment history in
            this build are local demo data and are not read from your account.
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
