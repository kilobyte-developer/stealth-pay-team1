import * as React from "react";
import { cn } from "@/lib/utils";

/** Uppercase eyebrow label used above section headings and card groups. */
export function SectionLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "font-display text-[0.7rem] font-bold tracking-[0.22em] uppercase",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
