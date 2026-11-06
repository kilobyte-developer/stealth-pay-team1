import * as React from "react";
import { FlaskConical } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-ink border-b-[3px] pb-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <SectionLabel className="text-blue">{eyebrow}</SectionLabel>
          <h1 className="mt-2.5 text-[clamp(1.75rem,4.5vw,3rem)]">{title}</h1>
          {description ? (
            <p className="text-grey mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Persistent reminder that this build is a frontend preview. Deliberately not
 * dismissible — nothing in the app should be mistaken for on-chain state.
 */
export function DemoModeBanner() {
  return (
    <div className="border-ink bg-coral/30 flex items-start gap-3 border-2 p-3.5">
      <span className="border-ink grid size-8 shrink-0 place-items-center border-2 bg-white">
        <FlaskConical className="size-4" aria-hidden="true" />
      </span>
      <p className="text-xs leading-relaxed sm:text-sm">
        <strong className="font-display">Frontend preview.</strong> Balances,
        payments, scanner activity and transaction hashes shown here are local
        demo data. No smart contracts are deployed, nothing is read from or
        written to Avalanche, and no transaction is ever broadcast.
      </p>
    </div>
  );
}
