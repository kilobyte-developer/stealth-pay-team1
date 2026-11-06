"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { NetworkSelector } from "@/components/wallet/network-selector";
import { MARKETING_NAV } from "@/config/nav";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="border-ink bg-paper/95 sticky top-0 z-40 border-b-[3px] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-display hover:bg-lime border-ink border-2 border-transparent px-3 py-1.5 text-xs font-bold tracking-wide uppercase transition-colors hover:border-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <NetworkSelector />
          </div>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            Launch App
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Button
            variant="secondary"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent size="sm" className="top-24 translate-y-0">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <nav className="flex flex-col gap-2">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="brutal-press border-ink shadow-brutal-xs hover:bg-lime font-display flex items-center justify-between border-2 bg-white px-3 py-3 text-sm font-bold uppercase"
              >
                {item.label}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className={buttonVariants({
                variant: "primary",
                size: "lg",
                className: "mt-2 w-full",
              })}
            >
              Launch App
            </Link>
            <div className="mt-2 sm:hidden">
              <NetworkSelector className="w-full justify-center" />
            </div>
          </nav>
        </DialogContent>
      </Dialog>
    </header>
  );
}
