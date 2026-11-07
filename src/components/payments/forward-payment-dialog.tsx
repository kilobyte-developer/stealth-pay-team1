"use client";

import * as React from "react";
import { isAddress, type Address } from "viem";
import {
  CircleCheck,
  ExternalLink,
  LoaderCircle,
  Send,
  TriangleAlert,
} from "lucide-react";
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
import { explorerTxUrl } from "@/lib/format";
import { useActiveNetwork } from "@/providers/wallet-provider";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import type { PaymentRow } from "@/lib/payments/view-model";

/**
 * Sweeps a detected stealth payment's full native balance to a destination
 * address, signing locally with the one-time key derived for that address.
 *
 * Only reachable for native payments (`payment.spendable`): an ERC-20
 * balance cannot pay its own gas, so there is nothing this dialog could do
 * for one yet.
 */
export function ForwardPaymentDialog({
  payment,
  open,
  onOpenChange,
  onForwarded,
}: {
  payment: PaymentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onForwarded?: () => void;
}) {
  const network = useActiveNetwork();
  const { forwardPayment } = useStealthIdentity();

  const [to, setTo] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [stage, setStage] = React.useState<
    "idle" | "forwarding" | "done" | "failed"
  >("idle");
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Cleared on close rather than in an effect, so this only ever runs in
  // response to the dismissal itself — never as a cascading render.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setTo("");
      setTouched(false);
      setStage("idle");
      setTxHash(null);
      setError(null);
    }
    onOpenChange(next);
  }

  if (!payment) return null;

  const toError = !to
    ? "Enter a destination address."
    : !isAddress(to)
      ? "Not a valid address."
      : null;

  async function handleForward() {
    if (!payment || toError) return;
    setStage("forwarding");
    setError(null);

    const result = await forwardPayment({
      stealthAddress: payment.stealthAddress as Address,
      ephemeralPublicKey: payment.ephemeralPublicKey as `0x${string}`,
      viewTag: payment.viewTag as `0x${string}`,
      schemeId: payment.schemeId,
      to: to as Address,
    });

    if (result.ok && result.txHash) {
      setTxHash(result.txHash);
      setStage("done");
      onForwarded?.();
    } else {
      setStage("failed");
      setError(result.error ?? "The forward could not be completed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward this payment</DialogTitle>
          <DialogDescription>
            Sweeps the full balance held at this one-time address to another
            address you control. The one-time spending key is derived
            locally, used once to sign, and destroyed immediately after.
          </DialogDescription>
        </DialogHeader>

        {stage === "done" ? (
          <div className="border-ink bg-lime mt-2 border-2 p-4">
            <div className="flex items-center gap-2">
              <CircleCheck className="size-4" aria-hidden="true" />
              <p className="font-display text-sm font-bold">
                Forwarded on-chain
              </p>
            </div>
            {txHash ? (
              <a
                href={explorerTxUrl(network, txHash as `0x${string}`)}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs break-all underline"
              >
                {txHash}
                <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : (
          <>
            <Field
              label="Destination address"
              htmlFor="forward-to"
              required
              error={touched ? toError : null}
              hint={`The full ${payment.assetLabel} balance at ${payment.stealthAddress.slice(0, 10)}… will be swept here, minus the network fee.`}
            >
              <Input
                id="forward-to"
                spellCheck={false}
                placeholder="0x…"
                value={to}
                onChange={(e) => setTo(e.target.value.trim())}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && toError ? true : undefined}
              />
            </Field>

            {error ? (
              <p
                role="alert"
                className="border-ink bg-coral/25 mt-4 flex items-start gap-2 border-2 p-3 text-xs leading-relaxed"
              >
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {error}
              </p>
            ) : null}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {stage === "done" ? "Close" : "Cancel"}
          </Button>
          {stage !== "done" ? (
            <Button
              variant="primary"
              disabled={!!toError || stage === "forwarding"}
              onClick={handleForward}
            >
              {stage === "forwarding" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              {stage === "forwarding" ? "Forwarding" : "Forward funds"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
