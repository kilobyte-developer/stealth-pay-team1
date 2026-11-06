import * as React from "react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/section-label";

const TONES = {
  paper: "bg-paper",
  paper2: "bg-paper-2",
  ink: "bg-ink text-paper",
  lime: "bg-lime",
  blue: "bg-blue text-white",
} as const;

export function Section({
  id,
  tone = "paper",
  bordered = true,
  grid = false,
  className,
  children,
}: {
  id?: string;
  tone?: keyof typeof TONES;
  bordered?: boolean;
  grid?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        TONES[tone],
        bordered && "border-ink border-b-[3px]",
        grid && "dot-grid",
        // Offsets the sticky header when jumping to an anchor.
        id && "scroll-mt-16",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  eyebrowClassName,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  eyebrowClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl",
        className,
      )}
    >
      <SectionLabel className={cn("text-blue", eyebrowClassName)}>
        {eyebrow}
      </SectionLabel>
      <h2 className="mt-3 text-[clamp(2rem,5.5vw,3.75rem)]">{title}</h2>
      {lead ? (
        <p className="mt-5 text-base leading-relaxed sm:text-lg">{lead}</p>
      ) : null}
    </div>
  );
}
