import { FlaskConical, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Marks any value that comes from the local mock layer rather than a chain.
 * Used liberally — the UI must never imply demo numbers are real balances or
 * confirmed on-chain transactions.
 */
export function DemoTag({
  label = "Demo data",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Badge tone="muted" size="xs" className={cn("gap-1", className)}>
      <FlaskConical className="size-2.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** Stronger inline notice for flows that do not touch the chain at all. */
export function NotBroadcastNotice({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-ink bg-coral/25 flex items-start gap-2.5 border-2 p-3",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="text-xs leading-relaxed font-medium">{children}</p>
    </div>
  );
}
