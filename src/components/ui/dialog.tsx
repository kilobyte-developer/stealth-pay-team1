"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: "sm" | "md" | "lg";
}) {
  const maxW = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
  }[size];

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-ink/55 data-[state=open]:animate-overlay-in fixed inset-0 z-50" />
      <DialogPrimitive.Content
        className={cn(
          "border-ink bg-paper shadow-brutal-lg data-[state=open]:animate-dialog-in",
          "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2",
          "max-h-[90vh] overflow-y-auto border-[3px] p-5 sm:p-6",
          maxW,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close dialog"
          className="border-ink hover:bg-lime absolute top-4 right-4 inline-flex size-8 items-center justify-center border-2 bg-white transition-colors"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("mb-5 pr-10", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-xl leading-tight font-bold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-grey mt-1.5 text-sm leading-relaxed", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-ink/15 mt-6 flex flex-col-reverse gap-2 border-t-2 pt-5 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
