import * as React from "react";
import { cn } from "@/lib/utils";

/** Monospace container for blockchain data (hashes, keys, addresses). */
export function MonoBlock({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-ink bg-paper-2 border-2 p-2.5 font-mono text-xs leading-relaxed break-all",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Label/value row for technical detail panels. */
export function DataRow({
  label,
  children,
  className,
  mono = true,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-ink/12 grid gap-1 border-b-2 py-2.5 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4",
        className,
      )}
    >
      <dt className="font-display text-[0.7rem] font-bold tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 text-sm break-all",
          mono ? "font-mono text-xs sm:text-[0.8rem]" : "",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function DataList({
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return <dl className={cn("", className)} {...props} />;
}
