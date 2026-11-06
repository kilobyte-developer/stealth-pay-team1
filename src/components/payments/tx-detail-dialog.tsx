"use client";

import { ArrowDownLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataList, DataRow } from "@/components/ui/mono";
import { CopyButton } from "@/components/ui/copy-button";
import { DemoTag } from "@/components/ui/demo-tag";
import { SectionLabel } from "@/components/ui/section-label";
import { formatAmount, formatBlock, formatDateTime } from "@/lib/format";
import type { StealthTransaction } from "@/types";

export function TxDetailDialog({
  tx,
  open,
  onOpenChange,
}: {
  tx: StealthTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!tx) return null;
  const incoming = tx.direction === "incoming";
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={incoming ? "lime" : "blue"} size="md">
              <Icon className="size-3" aria-hidden="true" />
              {incoming ? "Received" : "Sent"}
            </Badge>
            <StatusBadge status={tx.status} size="md" />
            <DemoTag />
          </div>
          <DialogTitle className="mt-3">
            {formatAmount(tx.amount)} {tx.assetSymbol}
          </DialogTitle>
          <DialogDescription>
            {incoming
              ? "Detected at a one-time stealth address controlled by your spending key."
              : "Sent directly from a one-time stealth address."}
          </DialogDescription>
        </DialogHeader>

        <DataList>
          <DataRow label="Transaction hash">
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all">{tx.txHash}</span>
              <CopyButton
                value={tx.txHash}
                what="Transaction hash"
                iconOnly
                variant="outline"
              />
            </span>
          </DataRow>

          <DataRow label="Block number" mono>
            {formatBlock(tx.blockNumber)}
          </DataRow>

          <DataRow label="One-time stealth address">
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all">{tx.stealthAddress}</span>
              <CopyButton
                value={tx.stealthAddress}
                what="Stealth address"
                iconOnly
                variant="outline"
              />
            </span>
          </DataRow>

          <DataRow label="Amount" mono={false}>
            <span className="font-display font-bold">
              {formatAmount(tx.amount)} {tx.assetSymbol}
            </span>
          </DataRow>

          <DataRow label={incoming ? "Sender" : "Destination"}>
            <span className="break-all">
              {tx.counterparty}
              {tx.counterpartyLabel ? (
                <span className="font-sans text-grey ml-2">
                  ({tx.counterpartyLabel})
                </span>
              ) : null}
            </span>
          </DataRow>

          {tx.assetContract ? (
            <DataRow label="Asset contract">
              <span className="break-all">{tx.assetContract}</span>
            </DataRow>
          ) : null}

          <DataRow label="Confirmations" mono>
            {formatBlock(tx.confirmations)}
          </DataRow>

          <DataRow label="Timestamp" mono={false}>
            {formatDateTime(tx.timestamp)}
          </DataRow>

          {tx.note ? (
            <DataRow label="Note" mono={false}>
              {tx.note}
            </DataRow>
          ) : null}
        </DataList>

        {/* Announcement data — only meaningful for detected incoming payments */}
        {tx.ephemeralPubKey ? (
          <div className="border-ink bg-paper-2 mt-5 border-2 p-4">
            <SectionLabel className="text-blue">
              ERC-5564 announcement
            </SectionLabel>
            <DataList className="mt-2">
              <DataRow label="Scheme ID" mono>
                {tx.schemeId ?? "—"}
              </DataRow>
              <DataRow label="Ephemeral public key">
                <span className="break-all">{tx.ephemeralPubKey}</span>
              </DataRow>
              <DataRow label="View tag" mono>
                {tx.viewTag ?? "—"}
              </DataRow>
            </DataList>
            <p className="text-grey mt-2 text-xs leading-relaxed">
              The ephemeral public key is published by the sender. Combined with
              your private viewing key it reproduces the shared secret that
              identifies this payment.
            </p>
          </div>
        ) : null}

        {/* Explorer placeholder — these hashes are not real, so no live link */}
        <div className="border-ink mt-5 border-2 border-dashed p-3.5">
          <p className="flex items-start gap-2 text-xs leading-relaxed">
            <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-display">Explorer link pending.</strong>{" "}
              This is demo data, so there is no Snowtrace record to open. Once
              payments run on Fuji, this will deep-link to the transaction.
            </span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
