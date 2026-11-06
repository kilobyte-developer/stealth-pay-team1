"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { APP_NAV } from "@/config/nav";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2" aria-label="Application">
      {APP_NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "brutal-press border-ink flex items-center gap-3 border-2 px-3 py-2.5",
              active
                ? "bg-lime shadow-brutal-sm"
                : "hover:shadow-brutal-xs bg-white",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-display text-xs font-bold tracking-wide uppercase">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar() {
  return (
    <aside className="border-ink bg-paper-2 hidden w-72 shrink-0 flex-col border-r-[3px] lg:flex">
      <div className="border-ink flex h-16 items-center border-b-[3px] px-5">
        <Logo />
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <SidebarNav />

        <Link
          href="/"
          className="text-grey hover:text-ink font-display mt-6 inline-flex items-center gap-2 text-[0.7rem] font-bold tracking-wide uppercase"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to site
        </Link>
      </div>

      <div className="border-ink border-t-[3px] p-5">
        <WalletPanel />
      </div>
    </aside>
  );
}
