import * as React from "react";
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
