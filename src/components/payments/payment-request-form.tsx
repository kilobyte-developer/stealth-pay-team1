"use client";

import * as React from "react";
import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SectionLabel } from "@/components/ui/section-label";
import { MonoBlock } from "@/components/ui/mono";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { assetsFor } from "@/config/networks";
import { useActiveNetwork } from "@/providers/wallet-provider";

/**
 * Builds a shareable payment-request string. This is a convenience annotation
 * only — nothing about it is enforced on-chain, and a sender can ignore or
 * change any of it.
 */
export function PaymentRequestForm({ metaAddress }: { metaAddress: string }) {
  const networkKey = useActiveNetwork();
  const assets = React.useMemo(() => assetsFor(networkKey), [networkKey]);
  const [asset, setAsset] = React.useState("AVAX");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [amountError, setAmountError] = React.useState<string | null>(null);

  function validateAmount(next: string) {
    setAmount(next);
    if (next === "") {
      setAmountError(null);
      return;
    }
    const n = Number(next);
    if (!Number.isFinite(n)) setAmountError("Enter a valid number.");
    else if (n <= 0) setAmountError("Amount must be greater than zero.");
    else setAmountError(null);
  }

  function reset() {
    setAsset("AVAX");
    setAmount("");
    setDescription("");
    setAmountError(null);
  }

  const requestUri = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("asset", asset);
    if (amount && !amountError) params.set("amount", amount);
    if (description.trim()) params.set("label", description.trim());
    return `${metaAddress}?${params.toString()}`;
  }, [metaAddress, asset, amount, description, amountError]);

  const selectedAsset = assets.find((a) => a.symbol === asset);

  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel className="text-grey">
            Expected payment (optional)
          </SectionLabel>
          <p className="text-grey mt-2 max-w-md text-sm leading-relaxed">
            Attach an asset, amount and label to the meta-address you share, so
            the sender knows what you are expecting.
          </p>
        </div>
        <Badge tone="muted" size="sm">
          Not enforced on-chain
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Asset" htmlFor="request-asset">
          <Select
            id="request-asset"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            {assets.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Expected amount"
          htmlFor="request-amount"
          error={amountError}
          hint="Leave blank for any amount."
        >
          <Input
            id="request-amount"
            inputMode="decimal"
            placeholder="10.0"
            value={amount}
            onChange={(e) => validateAmount(e.target.value)}
            aria-invalid={amountError ? true : undefined}
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor="request-description"
        className="mt-4"
        hint="Visible only to whoever you send this request to."
      >
        <Textarea
          id="request-description"
          rows={2}
          maxLength={140}
          placeholder="Invoice #1042 — October retainer"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      {selectedAsset && !selectedAsset.native ? (
        <p className="border-ink bg-paper-2 mt-4 flex items-start gap-2 border-2 p-3 text-xs leading-relaxed">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {selectedAsset.symbol} is an ERC-20 token. Ask the sender to
            include a native gas top-up so the payment can be moved later.
          </span>
        </p>
      ) : null}

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-[0.7rem] font-bold tracking-[0.16em] uppercase">
            Shareable request
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Reset
            </Button>
            <CopyButton
              value={requestUri}
              what="Payment request"
              variant="secondary"
              size="sm"
            />
          </div>
        </div>
        <MonoBlock className="mt-2">{requestUri}</MonoBlock>
      </div>
    </div>
  );
}
