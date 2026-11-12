"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Power,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectDialog } from "@/components/wallet/connect-dialog";
import { NameWalletDialog } from "@/components/wallet/name-wallet-dialog";
import { useWalletNickname } from "@/hooks/use-wallet-nickname";
import { useActiveNetwork, useWallet } from "@/providers/wallet-provider";
import { explorerAddressUrl, truncateMiddle } from "@/lib/format";
import { cn } from "@/lib/utils";

const menuContent =
  "border-ink shadow-brutal z-60 min-w-56 border-2 bg-white p-1";
const menuItem =
  "font-display flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-xs font-bold uppercase tracking-wide outline-none data-[highlighted]:bg-lime";

export function ConnectButton({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { status, address, walletName, disconnect, unsupportedChain } =
    useWallet();
  const network = useActiveNetwork();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const { name: nickname, prompted, saveName, dismiss } =
    useWalletNickname(address);
  const [nameDialogOpen, setNameDialogOpen] = React.useState(false);

  const connected = status === "connected" || status === "switching";

  // Offer the optional naming popup automatically for any connected address
  // that hasn't been asked yet. `prompted` flips to true (via storage) the
  // moment the user saves or skips, so this is derived, not effect-driven,
  // and naturally stops re-triggering once answered.
  const autoNamePrompt = connected && !!address && !prompted;
  const nameDialogIsOpen = nameDialogOpen || autoNamePrompt;

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the address is visible for manual copying */
    }
  }

  if (!connected) {
    return (
      <>
        <Button
          size={size}
          variant="dark"
          className={className}
          onClick={() => setDialogOpen(true)}
          disabled={status === "connecting"}
        >
          {status === "connecting" ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Wallet className="size-4" aria-hidden="true" />
          )}
          {status === "connecting" ? "Connecting" : "Connect Wallet"}
        </Button>
        <ConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            size={size}
            variant={unsupportedChain ? "coral" : "secondary"}
            className={cn("font-mono normal-case", className)}
          >
            {unsupportedChain ? (
              <TriangleAlert className="size-4" aria-hidden="true" />
            ) : (
              <span
                className="bg-lime border-ink size-2.5 border-2"
                aria-hidden="true"
              />
            )}
            <span className="flex flex-col items-start leading-tight">
              <span>
                {address ? truncateMiddle(address, 6, 4) : "Connected"}
              </span>
              {nickname ? (
                <span className="text-grey font-sans text-[0.6rem] font-normal normal-case">
                  {nickname}
                </span>
              ) : null}
            </span>
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className={menuContent}
          >
            <div className="border-ink/15 border-b-2 px-2.5 pt-1.5 pb-2.5">
              <p className="font-display text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                {walletName ?? "Wallet"}
              </p>
              <p className="mt-1 font-mono text-[0.7rem] break-all">
                {address}
              </p>
              {nickname ? (
                <p className="text-grey mt-1 text-[0.7rem]">{nickname}</p>
              ) : null}
            </div>

            {unsupportedChain ? (
              <p className="bg-coral/25 border-ink/15 m-1 border-2 p-2 text-[0.7rem] leading-relaxed font-medium">
                This wallet is on an unsupported chain. Switch to Avalanche
                Fuji to continue.
              </p>
            ) : null}

            <DropdownMenu.Item
              className={menuItem}
              onSelect={(e) => {
                e.preventDefault();
                void copyAddress();
              }}
            >
              {copied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy address"}
            </DropdownMenu.Item>

            {address ? (
              <DropdownMenu.Item asChild className={menuItem}>
                <a
                  href={explorerAddressUrl(network, address)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  View on explorer
                </a>
              </DropdownMenu.Item>
            ) : null}

            <DropdownMenu.Item
              className={menuItem}
              onSelect={(e) => {
                e.preventDefault();
                setNameDialogOpen(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {nickname ? "Edit name" : "Name this wallet"}
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="bg-ink/15 my-1 h-0.5" />

            <DropdownMenu.Item
              className={menuItem}
              onSelect={() => disconnect()}
            >
              <Power className="size-3.5" aria-hidden="true" />
              Disconnect
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <NameWalletDialog
        key={nameDialogIsOpen ? `${address}:open` : "wallet-name-dialog-idle"}
        address={address}
        initialName={nickname}
        open={nameDialogIsOpen}
        onOpenChange={setNameDialogOpen}
        onSave={saveName}
        onSkip={dismiss}
      />
    </>
  );
}
