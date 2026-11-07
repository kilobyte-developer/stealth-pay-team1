"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Inbox,
  LockKeyhole,
  LoaderCircle,
  RefreshCw,
  Send,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PaymentDetailDialog } from "@/components/payments/payment-detail-dialog";
import type { ActivityRow, PaymentRow } from "@/lib/payments/view-model";
import { explorerTxUrl, formatBlock, truncateMiddle } from "@/lib/format";
import type { StealthPaymentsState } from "@/hooks/use-stealth-payments";
import type { NetworkKey } from "@/types";

const DIRECTION_META: Record<
  ActivityRow["direction"],
  { label: string; tone: "lime" | "blue" | "ink"; Icon: typeof ArrowDownLeft }
> = {
  incoming: { label: "Received", tone: "lime", Icon: ArrowDownLeft },
  sent: { label: "Sent", tone: "blue", Icon: Send },
  forwarded: { label: "Forwarded", tone: "ink", Icon: ArrowUpRight },
};

function AddressCell({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-grey font-mono text-xs italic">Unknown</span>;
  }
  return <span className="font-mono text-xs">{truncateMiddle(value, 8, 6)}</span>;
}

/**
 * Every piece of activity this app knows about for the active identity:
 * detected incoming payments (from the chain scanner) PLUS this browser's
 * own record of sends and forwards it made (local — see
 * `src/lib/activity/local-log.ts`). Local entries show even when incoming
 * detection is unavailable (e.g. identity locked) — a send or forward this
 * browser already confirmed doesn't stop being real just because the
 * viewing key isn't loaded right now.
 */
export function ActivityTable({
  network,
  rows,
  status,
  reason,
  error,
  progress,
  rescan,
  onForwarded,
}: Pick<StealthPaymentsState, "status" | "reason" | "error" | "progress" | "rescan"> & {
  network: NetworkKey;
  /** Already merged (incoming + local) and already filtered/sorted by the caller. */
  rows: ActivityRow[];
  onForwarded: () => void;
}) {
  const [selected, setSelected] = React.useState<PaymentRow | null>(null);
  const [open, setOpen] = React.useState(false);

  function showIncoming(row: ActivityRow) {
    if (!row.incoming) return;
    setSelected(row.incoming);
    setOpen(true);
  }

  // Nothing at all to show, and nothing local to fall back on — explain why,
  // the same way PaymentsTable always has.
  if (rows.length === 0) {
    if (status === "unavailable") {
      if (reason === "identity-locked") {
        return (
          <EmptyState
            icon={LockKeyhole}
            title="Unlock your identity to see incoming payments"
            description="Matching announcements to you requires your private viewing key. Sends and forwards you've made in this browser would still show here even locked, if there were any."
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

    if (status === "scanning") {
      return (
        <div className="border-ink border-2 border-dashed bg-white px-6 py-12 text-center">
          <LoaderCircle className="mx-auto size-7 animate-spin" aria-hidden="true" />
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

    return (
      <EmptyState
        icon={Inbox}
        title="No activity yet"
        description="Received, sent, and forwarded payments all appear here once they happen."
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

  const incomingUnavailableNotice =
    status === "unavailable" ? (
      <p className="border-ink bg-paper-2 mb-4 flex items-start gap-2 border-2 p-3 text-xs leading-relaxed">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {reason === "identity-locked"
            ? "Incoming payment detection needs your identity unlocked — the rows below are sends and forwards this browser made, not a complete picture."
            : "No Announcer configured for this network — the rows below are sends and forwards this browser made, not incoming payments."}
        </span>
      </p>
    ) : status === "error" ? (
      <p className="border-ink bg-coral/25 mb-4 flex items-start gap-2 border-2 p-3 text-xs leading-relaxed">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Could not scan for incoming payments ({error ?? "RPC request failed"}) — the
          rows below are sends and forwards this browser made.
        </span>
      </p>
    ) : status === "scanning" ? (
      <p className="border-ink bg-paper-2 mb-4 flex items-center gap-2 border-2 p-3 text-xs leading-relaxed">
        <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
        Still scanning for incoming payments…
      </p>
    ) : null;

  return (
    <>
      {incomingUnavailableNotice}

      {/* Desktop */}
      <div className="border-ink hidden overflow-x-auto border-2 bg-white md:block">
        <table className="w-full min-w-[56rem] text-left">
          <caption className="sr-only">
            All activity: received, sent, and forwarded payments
          </caption>
          <thead className="border-ink bg-paper-2 border-b-2">
            <tr className="font-display text-[0.65rem] tracking-[0.16em] uppercase">
              <th scope="col" className="p-3 font-bold">
                Type
              </th>
              <th scope="col" className="p-3 font-bold">
                From
              </th>
              <th scope="col" className="p-3 font-bold">
                To
              </th>
              <th scope="col" className="p-3 font-bold">
                Asset
              </th>
              <th scope="col" className="p-3 text-right font-bold">
                Amount
              </th>
              <th scope="col" className="p-3 font-bold">
                Block
              </th>
              <th scope="col" className="p-3 text-right font-bold">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = DIRECTION_META[row.direction];
              return (
                <tr
                  key={row.id}
                  className="border-ink/12 hover:bg-lime/20 border-b-2 last:border-b-0"
                >
                  <td className="p-3">
                    <Badge tone={meta.tone} size="sm">
                      <meta.Icon className="size-3" aria-hidden="true" />
                      {meta.label}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <AddressCell value={row.from} />
                  </td>
                  <td className="p-3">
                    <AddressCell value={row.to} />
                  </td>
                  <td className="font-display p-3 text-xs font-bold">
                    {row.assetLabel}
                  </td>
                  <td className="font-display p-3 text-right text-sm font-bold">
                    {row.amount}
                  </td>
                  <td className="text-grey p-3 font-mono text-xs">
                    {row.blockNumber !== null
                      ? formatBlock(Number(row.blockNumber))
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {row.incoming ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => showIncoming(row)}
                        aria-label={`Details for ${truncateMiddle(row.to)}`}
                      >
                        View
                      </Button>
                    ) : (
                      <a
                        href={explorerTxUrl(network, row.transactionHash)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display inline-flex items-center gap-1.5 border-2 bg-white px-2.5 py-1.5 text-[0.65rem] font-bold uppercase"
                      >
                        View tx
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => {
          const meta = DIRECTION_META[row.direction];
          return (
            <li
              key={row.id}
              className="border-ink shadow-brutal-xs border-2 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Badge tone={meta.tone} size="sm">
                  <meta.Icon className="size-3" aria-hidden="true" />
                  {meta.label}
                </Badge>
                {row.blockNumber !== null ? (
                  <span className="text-grey font-mono text-[0.65rem]">
                    block {formatBlock(Number(row.blockNumber))}
                  </span>
                ) : null}
              </div>

              <p className="font-display mt-3 text-xl font-bold">
                {row.amount} <span className="text-sm">{row.assetLabel}</span>
              </p>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-grey text-[0.6rem] font-bold tracking-wider uppercase">
                    From
                  </span>
                  <AddressCell value={row.from} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-grey text-[0.6rem] font-bold tracking-wider uppercase">
                    To
                  </span>
                  <AddressCell value={row.to} />
                </div>
              </div>

              {row.incoming ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => showIncoming(row)}
                >
                  View details
                </Button>
              ) : (
                <a
                  href={explorerTxUrl(network, row.transactionHash)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display mt-3 flex items-center justify-center gap-1.5 border-2 bg-white px-3 py-2 text-xs font-bold uppercase"
                >
                  View transaction
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <PaymentDetailDialog
        payment={selected}
        open={open}
        onOpenChange={setOpen}
        onForwarded={onForwarded}
      />
    </>
  );
}
