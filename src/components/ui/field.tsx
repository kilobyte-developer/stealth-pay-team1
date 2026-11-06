import * as React from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const controlBase = [
  "w-full border-2 border-ink bg-white text-ink",
  "font-mono text-sm placeholder:text-grey-soft placeholder:font-sans",
  "transition-shadow duration-150",
  "focus:shadow-brutal-xs focus:outline-none",
  "focus-visible:outline-3 focus-visible:outline-blue focus-visible:outline-offset-2",
  "disabled:bg-paper-2 disabled:text-grey disabled:cursor-not-allowed",
  "aria-[invalid=true]:bg-coral/15",
].join(" ");

export function Label({
  className,
  children,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "font-display text-[0.7rem] font-bold tracking-[0.16em] uppercase",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input className={cn(controlBase, "h-12 px-3", className)} {...props} />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlBase, "min-h-24 resize-y px-3 py-2.5", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlBase,
          "font-display h-12 appearance-none pr-10 pl-3 font-bold tracking-wide uppercase",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  );
}

export function FieldHint({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-grey text-xs leading-relaxed", className)} {...props}>
      {children}
    </p>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="flex items-center gap-1.5 text-xs font-bold text-coral-deep"
    >
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Label + control + hint/error wrapper with wired-up accessibility ids. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-coral-deep ml-1">*</span> : null}
      </Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}
