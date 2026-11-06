"use client";

import * as React from "react";
import {
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const { available, connect, status, error, clearError, rescan } = useWallet();
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
              No wallet detected yet
            </p>
            <p className="text-grey mx-auto mt-1.5 max-w-xs text-xs leading-relaxed">
              Extensions sometimes load after the page does. Try scanning again
              before installing anything.
            </p>

            <Button
              variant="primary"
              size="md"
              className="mt-4"
              onClick={rescan}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Scan again
            </Button>

            <p className="text-grey mx-auto mt-4 max-w-xs text-xs leading-relaxed">
              Still nothing? Install one of these, then reopen this dialog.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
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

        <p className="text-grey mt-5 text-[0.7rem] leading-relaxed">
          StealthPay reads your address and chain only. Your stealth keys are a
          separate key system and are never derived from this wallet.
        </p>
      </DialogContent>
    </Dialog>
  );
}
