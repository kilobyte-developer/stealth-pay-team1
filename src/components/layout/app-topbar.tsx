"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NetworkSelector } from "@/components/wallet/network-selector";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { APP_NAV } from "@/config/nav";
import { cn } from "@/lib/utils";

/** Four most-used destinations, surfaced as a thumb-reachable mobile bar. */
const BOTTOM_NAV = APP_NAV.filter((i) =>
  ["/dashboard", "/receive", "/send", "/activity"].includes(i.href),
);

export function AppTopbar() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="border-ink bg-paper/95 sticky top-0 z-30 border-b-[3px] backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
          <div className="lg:hidden">
            <Logo compact />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <NetworkSelector />
            </div>
            <ConnectButton size="md" />
            <Button
              variant="secondary"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" className="top-20 translate-y-0">
          <DialogTitle className="font-display text-base">
            StealthPay
          </DialogTitle>
          <nav className="mt-4 space-y-2" aria-label="Application">
            {APP_NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "border-ink flex items-start gap-3 border-2 px-3 py-2.5",
                    active ? "bg-lime shadow-brutal-xs" : "bg-white",
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="font-display block text-xs font-bold tracking-wide uppercase">
                      {item.label}
                    </span>
                    <span className="text-grey mt-0.5 block text-[0.7rem]">
                      {item.hint}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="border-ink/15 mt-5 border-t-2 pt-5">
            <WalletPanel />
          </div>

          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="text-grey font-display mt-4 inline-block text-[0.7rem] font-bold tracking-wide uppercase"
          >
            ← Back to site
          </Link>
        </DialogContent>
      </Dialog>

      {/* Mobile bottom bar */}
      <div className="border-ink bg-paper-2 fixed inset-x-0 bottom-0 z-30 border-t-[3px] lg:hidden">
        <ul className="grid grid-cols-4">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2",
                    active ? "bg-lime" : "",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="font-display text-[0.6rem] font-bold tracking-wide uppercase">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
