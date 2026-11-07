"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  Fuel,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PaymentDetailDialog } from "@/components/payments/payment-detail-dialog";
import { toPaymentRow, type PaymentRow } from "@/lib/payments/view-model";
import { formatBlock, truncateMiddle } from "@/lib/format";
import type { StealthPaymentsState } from "@/hooks/use-stealth-payments";

/**
 * Detected payments, read from the chain.
 *
 * Renders one of four honest states: unavailable (and why), scanning, empty,
 * or results. There is no placeholder row — if nothing has been received, the
 * table says so.
 */
export function PaymentsTable({
  payments,
  status,
  reason,
  error,
  progress,
  rescan,
  compact = false,
}: Pick<
  StealthPaymentsState,
  "payments" | "status" | "reason" | "error" | "progress" | "rescan"
> & { compact?: boolean }) {
  const [selected, setSelected] = React.useState<PaymentRow | null>(null);
  const [open, setOpen] = React.useState(false);

  const rows = React.useMemo(
    () => payments.map(toPaymentRow),
    [payments],
  );

  function show(row: PaymentRow) {
    setSelected(row);
    setOpen(true);
  }

  if (status === "unavailable") {
    if (reason === "identity-locked") {
      return (
        <EmptyState
          icon={LockKeyhole}
          title="Unlock your identity to see payments"
          description="Matching announcements to you requires your private viewing key, which stays encrypted until you unlock."
          action={
            <Link
              href="/identity"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              Unlock identity
            </Link>
          }
        />
      );
    }

    return (
      <EmptyState
        icon={Settings2}
        title="No Announcer contract configured"
        description="Payment detection reads ERC-5564 Announcement logs. Set the Announcer address for this network to start scanning."
        action={
          <Link
            href="/settings"
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            Open settings
          </Link>
        }
      />
    );
  }

  if (status === "error") {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Could not scan announcements"
        description={error ?? "The RPC request failed."}
        action={
          <Button variant="primary" size="md" onClick={rescan}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  if (status === "scanning" && rows.length === 0) {
    return (
      <div className="border-ink border-2 border-dashed bg-white px-6 py-12 text-center">
        <LoaderCircle
          className="mx-auto size-7 animate-spin"
          aria-hidden="true"
        />
        <p className="font-display mt-4 text-base font-bold">
          Scanning announcements
        </p>
        {progress ? (
          <p className="text-grey mt-1.5 font-mono text-xs">
            block {formatBlock(Number(progress.toBlock))} /{" "}
            {formatBlock(Number(progress.headBlock))} ·{" "}
            {progress.announcementsSeen} seen
          </p>
        ) : null}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No payments yet"
        description="Share your stealth meta-address to receive one. Detected payments appear here once an announcement matches your viewing key and the transfer is verified on-chain."
        action={
          <Link
            href="/receive"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            Share meta-address
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="border-ink hidden overflow-x-auto border-2 bg-white md:block">
        <table className="w-full min-w-[48rem] text-left">
          <caption className="sr-only">
            Detected stealth payments, verified on-chain
          </caption>
          <thead className="border-ink bg-paper-2 border-b-2">
            <tr className="font-display text-[0.65rem] tracking-[0.16em] uppercase">
              <th scope="col" className="p-3 font-bold">
                Stealth address
              </th>
              <th scope="col" className="p-3 font-bold">
                Asset
              </th>
              <th scope="col" className="p-3 text-right font-bold">
                Balance
              </th>
              {compact ? null : (
                <th scope="col" className="p-3 font-bold">
                  Block
                </th>
              )}
              <th scope="col" className="p-3 font-bold">
                Spendable
              </th>
              <th scope="col" className="p-3 text-right font-bold">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-ink/12 hover:bg-lime/20 border-b-2 last:border-b-0"
              >
                <td className="p-3">
                  <p className="font-mono text-xs">
                    {truncateMiddle(row.stealthAddress, 10, 6)}
                  </p>
                  <p className="text-grey mt-0.5 font-mono text-[0.65rem]">
                    tx {truncateMiddle(row.transactionHash, 8, 6)}
                  </p>
                </td>
                <td className="font-display p-3 text-xs font-bold">
                  {row.assetLabel}
                </td>
                <td className="font-display p-3 text-right text-sm font-bold">
                  {row.verifiedAmount}
                </td>
                {compact ? null : (
                  <td className="text-grey p-3 font-mono text-xs">
                    {formatBlock(Number(row.blockNumber))}
                  </td>
                )}
                <td className="p-3">
                  {row.spendable ? (
                    <Badge tone="lime" size="sm">
                      <ArrowDownLeft className="size-3" aria-hidden="true" />
                      Yes
                    </Badge>
                  ) : (
                    <Badge tone="coral" size="sm">
                      <Fuel className="size-3" aria-hidden="true" />
                      Needs gas
                    </Badge>
                  )}
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => show(row)}
                    aria-label={`Details for ${truncateMiddle(row.stealthAddress)}`}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="border-ink shadow-brutal-xs border-2 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <Badge tone="lime" size="sm">
                <ArrowDownLeft className="size-3" aria-hidden="true" />
                Received
              </Badge>
              {row.spendable ? null : (
                <Badge tone="coral" size="sm">
                  <Fuel className="size-3" aria-hidden="true" />
                  Needs gas
                </Badge>
              )}
            </div>

            <p className="font-display mt-3 text-xl font-bold">
              {row.verifiedAmount}{" "}
              <span className="text-sm">{row.assetLabel}</span>
            </p>
            <p className="text-grey mt-2 font-mono text-[0.7rem] break-all">
              {truncateMiddle(row.stealthAddress, 14, 8)}
            </p>

            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => show(row)}
            >
              View details
            </Button>
          </li>
        ))}
      </ul>

      <PaymentDetailDialog
        payment={selected}
        open={open}
        onOpenChange={setOpen}
        onForwarded={rescan}
      />
    </>
  );
}
