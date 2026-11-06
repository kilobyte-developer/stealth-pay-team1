"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TxDetailDialog } from "@/components/payments/tx-detail-dialog";
import { formatAmount, formatDateShort, truncateMiddle } from "@/lib/format";
import type { StealthTransaction } from "@/types";

function DirectionBadge({ tx }: { tx: StealthTransaction }) {
  const incoming = tx.direction === "incoming";
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <Badge tone={incoming ? "lime" : "blue"} size="sm">
      <Icon className="size-3" aria-hidden="true" />
      {incoming ? "Received" : "Sent"}
    </Badge>
  );
}

export function ActivityTable({
  transactions,
  emptyHint,
}: {
  transactions: StealthTransaction[];
  emptyHint?: string;
}) {
  const [selected, setSelected] = React.useState<StealthTransaction | null>(
    null,
  );
  const [open, setOpen] = React.useState(false);

  function show(tx: StealthTransaction) {
    setSelected(tx);
    setOpen(true);
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No transactions match"
        description={
          emptyHint ??
          "Adjust the filters above, or wait for the scanner to detect a new payment."
        }
      />
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="border-ink hidden overflow-x-auto border-2 bg-white md:block">
        <table className="w-full min-w-[52rem] text-left">
          <caption className="sr-only">
            Stealth payment transactions, newest first
          </caption>
          <thead className="border-ink bg-paper-2 border-b-2">
            <tr className="font-display text-[0.65rem] tracking-[0.16em] uppercase">
              <th scope="col" className="p-3 font-bold">
                Transaction
              </th>
              <th scope="col" className="p-3 font-bold">
                Type
              </th>
              <th scope="col" className="p-3 font-bold">
                Asset
              </th>
              <th scope="col" className="p-3 text-right font-bold">
                Amount
              </th>
              <th scope="col" className="p-3 font-bold">
                Status
              </th>
              <th scope="col" className="p-3 font-bold">
                Date (UTC)
              </th>
              <th scope="col" className="p-3 text-right font-bold">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-ink/12 hover:bg-lime/20 border-b-2 last:border-b-0"
              >
                <td className="p-3">
                  <p className="font-mono text-xs">
                    {truncateMiddle(tx.txHash, 10, 6)}
                  </p>
                  <p className="text-grey mt-0.5 font-mono text-[0.65rem]">
                    → {truncateMiddle(tx.stealthAddress, 8, 6)}
                  </p>
                </td>
                <td className="p-3">
                  <DirectionBadge tx={tx} />
                </td>
                <td className="font-display p-3 text-xs font-bold">
                  {tx.assetSymbol}
                </td>
                <td className="font-display p-3 text-right text-sm font-bold">
                  {formatAmount(tx.amount)}
                </td>
                <td className="p-3">
                  <StatusBadge status={tx.status} />
                </td>
                <td className="text-grey p-3 font-mono text-xs">
                  {formatDateShort(tx.timestamp)}
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => show(tx)}
                    aria-label={`View details for transaction ${truncateMiddle(tx.txHash)}`}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {transactions.map((tx) => (
          <li
            key={tx.id}
            className="border-ink shadow-brutal-xs border-2 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <DirectionBadge tx={tx} />
              <StatusBadge status={tx.status} />
            </div>

            <p className="font-display mt-3 text-xl font-bold">
              {formatAmount(tx.amount)}{" "}
              <span className="text-sm">{tx.assetSymbol}</span>
            </p>

            <p className="text-grey mt-2 font-mono text-[0.7rem] break-all">
              {truncateMiddle(tx.stealthAddress, 14, 8)}
            </p>
            <p className="text-grey mt-1 font-mono text-[0.65rem]">
              {formatDateShort(tx.timestamp)} UTC
            </p>

            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => show(tx)}
            >
              View details
            </Button>
          </li>
        ))}
      </ul>

      <TxDetailDialog tx={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
