import Link from "next/link";
import { ArrowDownToLine, ArrowRight, KeyRound, Radar, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

interface Action {
  href: string;
  label: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}

const ACTIONS: Action[] = [
  {
    href: "/receive",
    label: "Receive Privately",
    body: "Share your stealth meta-address or QR code.",
    icon: ArrowDownToLine,
    tone: "bg-lime",
  },
  {
    href: "/send",
    label: "Send Payment",
    body: "Derive a one-time address for a recipient.",
    icon: Send,
    tone: "bg-blue text-white",
  },
  {
    href: "/scanner",
    label: "Scan Blockchain",
    body: "Watch announcement detection in progress.",
    icon: Radar,
    tone: "bg-coral",
  },
  {
    href: "/identity",
    label: "View Stealth Identity",
    body: "Inspect your viewing and spending keys.",
    icon: KeyRound,
    tone: "bg-paper-2",
  },
];

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <SectionLabel id="quick-actions-heading" className="text-grey">
        Quick actions
      </SectionLabel>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="brutal-press border-ink shadow-brutal-sm hover:shadow-brutal group flex flex-col border-2 bg-white p-4"
            >
              <span
                className={cn(
                  "border-ink grid size-11 place-items-center border-2",
                  a.tone,
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>

              <span className="font-display mt-4 text-sm leading-tight font-bold">
                {a.label}
              </span>
              <span className="text-grey mt-1.5 flex-1 text-xs leading-relaxed">
                {a.body}
              </span>

              <ArrowRight
                className="mt-3 size-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
