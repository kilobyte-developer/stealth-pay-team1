"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CopyButton({
  value,
  label = "Copy",
  what = "Value",
  size = "sm",
  variant = "secondary",
  iconOnly = false,
  className,
}: {
  value: string;
  label?: string;
  what?: string;
  size?: "sm" | "md" | "icon-sm" | "icon";
  variant?: "primary" | "secondary" | "outline" | "ghost" | "dark";
  iconOnly?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();
  const timer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ tone: "success", title: `${what} copied` });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({
        tone: "warning",
        title: "Could not copy",
        description: "Your browser blocked clipboard access. Select and copy manually.",
      });
    }
  }

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? (size === "md" ? "icon" : "icon-sm") : size}
      onClick={handleCopy}
      aria-label={iconOnly ? `${label} ${what.toLowerCase()}` : undefined}
      className={cn(className)}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {iconOnly ? null : copied ? "Copied" : label}
    </Button>
  );
}
