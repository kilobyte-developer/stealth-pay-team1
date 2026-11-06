import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-ink flex flex-col items-center justify-center border-2 border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <span className="border-ink bg-paper-2 mb-4 inline-flex size-14 items-center justify-center border-2">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="font-display text-base font-bold">{title}</p>
      {description ? (
        <p className="text-grey mt-1.5 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
