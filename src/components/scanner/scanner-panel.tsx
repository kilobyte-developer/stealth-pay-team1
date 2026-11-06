"use client";

import {
  CircleCheck,
  LoaderCircle,
  LockKeyhole,
  Radar,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { useStealthPayments } from "@/hooks/use-stealth-payments";
import { useActiveNetwork } from "@/providers/wallet-provider";
import { CONTRACTS, NETWORKS } from "@/config/networks";
import { formatBlock, formatCount, truncateMiddle } from "@/lib/format";

/**
 * Live scanner status, driven by the real log scan.
 *
 * Every counter here comes from an actual `getLogs` pass over the Announcer.
 * When prerequisites are missing the panel says which one, rather than showing
 * activity that is not happening.
 */
export function ScannerPanel() {
  const state = useStealthPayments();
  const network = useActiveNetwork();
  const announcer = CONTRACTS[network].announcer;

  const scanning = state.status === "scanning";

  const stats = [
    {
      k: "Announcements read",
      v: state.status === "unavailable" ? "—" : formatCount(state.announcementsSeen),
    },
    {
      k: "View-tag matches",
      v: state.status === "unavailable" ? "—" : formatCount(state.viewTagMatches),
    },
    {
      k: "Payments verified",
      v: state.status === "unavailable" ? "—" : formatCount(state.payments.length),
    },
    {
      k: "Scanned to block",
      v:
        state.lastScannedBlock !== null
          ? formatBlock(Number(state.lastScannedBlock))
          : "—",
    },
    {
      k: "Chain head",
      v: state.headBlock !== null ? formatBlock(Number(state.headBlock)) : "—",
    },
    {
      k: "Announcer",
      v: announcer ? truncateMiddle(announcer, 6, 4) : "not configured",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-ink shadow-brutal-md border-[3px] bg-white">
        <div className="border-ink bg-ink text-paper flex flex-wrap items-center justify-between gap-4 border-b-[3px] p-5">
          <div className="flex items-center gap-3">
            <span className="border-paper bg-lime text-ink grid size-11 shrink-0 place-items-center border-2">
              <Radar
                className={scanning ? "size-5 animate-blink" : "size-5"}
                aria-hidden="true"
              />
            </span>
            <div>
              <SectionLabel className="text-lime">Scanner</SectionLabel>
              <p
                className="font-display mt-1 flex items-center gap-2 text-base font-bold"
                aria-live="polite"
              >
                {state.status === "scanning"
                  ? "Scanning announcements"
                  : state.status === "ready"
                    ? "Up to date"
                    : state.status === "error"
                      ? "Scan failed"
                      : "Idle"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="white" size="md">
              {NETWORKS[network].shortName}
            </Badge>
            {state.status !== "unavailable" ? (
              <Button variant="secondary" size="sm" onClick={state.rescan}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Rescan
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s, i) => (
            <div
              key={s.k}
              className={`border-ink/15 p-4 ${i < stats.length - 1 ? "border-b-2 sm:border-r-2" : ""} ${i >= 3 ? "sm:border-b-0" : ""}`}
            >
              <dt className="font-display text-[0.6rem] font-bold tracking-[0.14em] uppercase">
                {s.k}
              </dt>
              <dd className="font-display mt-1.5 font-mono text-sm font-bold">
                {s.v}
              </dd>
            </div>
          ))}
        </dl>

        {scanning && state.progress ? (
          <div className="border-ink/15 flex items-center gap-2 border-t-2 p-4">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            <p className="font-mono text-xs">
              blocks {formatBlock(Number(state.progress.fromBlock))}–
              {formatBlock(Number(state.progress.toBlock))} of{" "}
              {formatBlock(Number(state.progress.headBlock))}
            </p>
          </div>
        ) : null}
      </div>

      {/* Prerequisites */}
      {state.status === "unavailable" ? (
        <div className="border-ink border-2 border-dashed bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            {state.reason === "identity-locked" ? (
              <LockKeyhole className="size-5 shrink-0" aria-hidden="true" />
            ) : (
              <Settings2 className="size-5 shrink-0" aria-hidden="true" />
            )}
            <SectionLabel>Scanning prerequisites</SectionLabel>
          </div>

          <ul className="mt-4 space-y-3">
            <li className="flex items-start gap-2.5 text-sm leading-relaxed">
              {state.reason === "identity-locked" ? (
                <TriangleAlert className="text-coral-deep mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                <strong className="font-display">Unlocked identity</strong> —
                matching needs your private viewing key.
              </span>
            </li>
            <li className="flex items-start gap-2.5 text-sm leading-relaxed">
              {announcer ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <TriangleAlert className="text-coral-deep mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                <strong className="font-display">Announcer address</strong> —
                there is nothing to read without one.
              </span>
            </li>
          </ul>

          {state.reason === "identity-locked" ? (
            <Link
              href="/identity"
              className={buttonVariants({
                variant: "primary",
                size: "md",
                className: "mt-5",
              })}
            >
              Unlock identity
            </Link>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="border-ink bg-coral/25 border-2 p-3 text-xs leading-relaxed font-medium"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
