"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { truncateMiddle } from "@/lib/format";
import type { Hex } from "@/types";

const MAX_LENGTH = 32;

/**
 * Optional "name this account" popup. Shown once automatically the first
 * time an address connects, and reachable afterward from the wallet menu to
 * rename or clear it. Skipping (or dismissing in any way) just leaves the
 * wallet address displayed, exactly as before — naming is never required.
 *
 * The caller should remount this with a fresh `key` each time it opens (see
 * `connect-button.tsx`), so the input's local state always starts clean
 * instead of needing an effect or a ref check to reset it.
 */
export function NameWalletDialog({
  address,
  initialName,
  open,
  onOpenChange,
  onSave,
  onSkip,
}: {
  address: Hex | null;
  initialName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
  onSkip: () => void;
}) {
  const [value, setValue] = React.useState(initialName ?? "");
  const savedRef = React.useRef(false);

  function handleOpenChange(next: boolean) {
    if (!next && !savedRef.current) onSkip();
    onOpenChange(next);
  }

  function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    savedRef.current = true;
    onSave(trimmed);
    onOpenChange(false);
  }

  if (!address) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Name this account?</DialogTitle>
          <DialogDescription>
            Give {truncateMiddle(address, 6, 4)} a label only you see in this
            browser — it never leaves your device. Optional: skip to keep
            showing the wallet address as-is.
          </DialogDescription>
        </DialogHeader>

        <Field label="Account name" htmlFor="wallet-nickname">
          <Input
            id="wallet-nickname"
            placeholder="e.g. Trading wallet"
            maxLength={MAX_LENGTH}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            <X className="size-4" aria-hidden="true" />
            Skip
          </Button>
          <Button
            variant="primary"
            disabled={!value.trim()}
            onClick={handleSave}
          >
            <Check className="size-4" aria-hidden="true" />
            Save name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
