import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Status / label chip. Black text on solid fills, consistent across the app. */
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 border-ink border-2 font-display font-bold uppercase tracking-wider whitespace-nowrap",
  {
    variants: {
      tone: {
        lime: "bg-lime text-ink",
        blue: "bg-blue text-white",
        coral: "bg-coral text-ink",
        ink: "bg-ink text-paper",
        white: "bg-white text-ink",
        paper: "bg-paper-2 text-ink",
        muted: "bg-paper-2 text-grey border-grey-soft",
      },
      size: {
        xs: "h-5 px-1.5 text-[0.6rem]",
        sm: "h-6 px-2 text-[0.65rem]",
        md: "h-7 px-2.5 text-xs",
      },
    },
    defaultVariants: { tone: "white", size: "sm" },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
  );
}
