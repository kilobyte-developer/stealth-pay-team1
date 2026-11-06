import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Geometric privacy mark: a shield whose interior is split into offset blocks,
 * standing for one identity resolving into many one-time addresses.
 */
export function StealthMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      <path
        d="M12 2.5 3.5 5.5v6.2c0 4.6 3.5 8 8.5 9.8 5-1.8 8.5-5.2 8.5-9.8V5.5L12 2.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M12 7.2h5v5h-5z" fill="currentColor" />
      <path d="M7 11.2h5v5H7z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function Logo({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 focus-visible:outline-offset-4",
        className,
      )}
    >
      <span className="border-ink bg-lime group-hover:bg-blue grid size-9 shrink-0 place-items-center border-2 transition-colors group-hover:text-white">
        <StealthMark />
      </span>
      {compact ? null : (
        <span className="font-display text-lg leading-none font-bold tracking-tight">
          Stealth<span className="text-blue">Pay</span>
        </span>
      )}
    </Link>
  );
}

export function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.07-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.15 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.99 7.99 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
