import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Brutalist button. Shadow depth encodes importance:
 * primary/dark/blue/coral sit on `shadow-brutal`, quieter variants on
 * `shadow-brutal-sm`, and ghost/link carry no shadow at all.
 */
export const buttonVariants = cva(
  [
    "brutal-press inline-flex items-center justify-center gap-2",
    "font-display font-bold uppercase tracking-wide",
    "border-ink select-none whitespace-nowrap",
    "disabled:pointer-events-none disabled:opacity-45",
    "disabled:translate-x-0 disabled:translate-y-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "border-2 bg-lime text-ink shadow-brutal hover:shadow-brutal-md hover:bg-lime-deep active:shadow-brutal-xs",
        dark: "border-2 bg-ink text-paper shadow-brutal hover:shadow-brutal-md active:shadow-brutal-xs",
        secondary:
          "border-2 bg-white text-ink shadow-brutal-sm hover:shadow-brutal active:shadow-brutal-xs",
        blue: "border-2 bg-blue text-white shadow-brutal hover:shadow-brutal-md hover:bg-blue-deep active:shadow-brutal-xs",
        coral:
          "border-2 bg-coral text-ink shadow-brutal hover:shadow-brutal-md hover:bg-coral-deep active:shadow-brutal-xs",
        outline:
          "border-2 bg-transparent text-ink shadow-brutal-sm hover:bg-white hover:shadow-brutal active:shadow-brutal-xs",
        ghost:
          "border-2 border-transparent bg-transparent text-ink hover:border-ink hover:bg-white",
        link: "border-0 bg-transparent p-0 text-ink underline decoration-2 underline-offset-4 hover:decoration-4",
      },
      size: {
        sm: "h-9 px-3 text-[0.7rem]",
        md: "h-11 px-5 text-xs",
        lg: "h-14 px-7 text-sm",
        xl: "h-16 px-9 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
