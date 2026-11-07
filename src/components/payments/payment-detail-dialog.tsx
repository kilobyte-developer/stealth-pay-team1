"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataList, DataRow } from "@/components/ui/mono";
import { CopyButton } from "@/components/ui/copy-button";
import { SectionLabel } from "@/components/ui/section-label";
import { ForwardPaymentDialog } from "@/components/payments/forward-payment-dialog";
import { explorerAddressUrl, explorerTxUrl, formatBlock } from "@/lib/format";
import { useActiveNetwork } from "@/providers/wallet-provider";
import type { PaymentRow } from "@/lib/payments/view-model";

export function PaymentDetailDialog({
  payment,
  open,
  onOpenChange,
  onForwarded,
}: {
  payment: PaymentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful forward, so the caller can refresh balances. */
  onForwarded?: () => void;
}) {
  const network = useActiveNetwork();
  const [forwardOpen, setForwardOpen] = React.useState(false);
  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="lime" size="md">
              <ArrowDownLeft className="size-3" aria-hidden="true" />
              Received
            </Badge>
            <Badge tone="white" size="md">
              Scheme {payment.schemeId}
            </Badge>
          </div>
          <DialogTitle className="mt-3">
            {payment.verifiedAmount} {payment.assetLabel}
          </DialogTitle>
          <DialogDescription>
            Held at a one-time stealth address controlled by your spending key.
          </DialogDescription>
        </DialogHeader>

        <DataList>
          <DataRow label="Balance now" mono={false}>
            <span className="font-display font-bold">
              {payment.verifiedAmount} {payment.assetLabel}
            </span>
            <span className="text-grey mt-0.5 block font-sans text-xs">
              Read from the chain just now.
            </span>
          </DataRow>

          <DataRow label="Declared amount" mono={false}>
            {payment.declaredAmount ? (
              <>
                <span>
                  {payment.declaredAmount} {payment.assetLabel}
                </span>
                <span className="text-grey mt-0.5 block font-sans text-xs">
                  What the announcement claimed. The balance above is the
                  verified figure.
                </span>
              </>
            ) : (
              <span className="text-grey text-xs">Not stated in metadata</span>
            )}
          </DataRow>

          <DataRow label="One-time stealth address">
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all">{payment.stealthAddress}</span>
              <CopyButton
                value={payment.stealthAddress}
                what="Stealth address"
                iconOnly
                variant="outline"
              />
            </span>
          </DataRow>

          <DataRow label="Transaction hash">
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all">
                {payment.transactionHash}
              </span>
              <CopyButton
                value={payment.transactionHash}
                what="Transaction hash"
                iconOnly
                variant="outline"
              />
            </span>
          </DataRow>

          <DataRow label="Block" mono>
            {formatBlock(Number(payment.blockNumber))}
          </DataRow>

          {payment.token ? (
            <DataRow label="Token contract">
              <span className="break-all">{payment.token}</span>
            </DataRow>
          ) : null}
        </DataList>

        <div className="border-ink bg-paper-2 mt-5 border-2 p-4">
          <SectionLabel className="text-blue">
            ERC-5564 announcement
          </SectionLabel>
          <DataList className="mt-2">
            <DataRow label="Ephemeral public key">
              <span className="break-all">{payment.ephemeralPublicKey}</span>
            </DataRow>
            <DataRow label="View tag" mono>
              {payment.viewTag}
            </DataRow>
            <DataRow label="Announced by">
              <span className="break-all">{payment.announcer}</span>
              <span className="font-sans text-grey mt-0.5 block text-[0.7rem]">
                The contract that called `announce` — a payment router, not
                necessarily the payer.
              </span>
            </DataRow>
          </DataList>
        </div>

        {!payment.spendable ? (
          <div className="border-ink bg-coral/25 mt-5 flex items-start gap-2.5 border-2 p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-xs leading-relaxed">
              This address holds a token but needs native AVAX to pay gas before
              the token can be moved.
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {payment.spendable ? (
            <Button
              variant="dark"
              size="sm"
              onClick={() => setForwardOpen(true)}
            >
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              Forward funds
            </Button>
          ) : null}
          <a
            href={explorerTxUrl(network, payment.transactionHash)}
            target="_blank"
            rel="noreferrer noopener"
            className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display inline-flex items-center gap-1.5 border-2 bg-white px-3 py-2 text-[0.7rem] font-bold uppercase"
          >
            View transaction
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          <a
            href={explorerAddressUrl(network, payment.stealthAddress)}
            target="_blank"
            rel="noreferrer noopener"
            className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display inline-flex items-center gap-1.5 border-2 bg-white px-3 py-2 text-[0.7rem] font-bold uppercase"
          >
            View address
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </DialogContent>

      <ForwardPaymentDialog
        payment={payment}
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        onForwarded={() => {
          onForwarded?.();
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
