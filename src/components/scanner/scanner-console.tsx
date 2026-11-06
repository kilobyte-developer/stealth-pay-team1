"use client";

import {
  CircleCheck,
  CircleSlash,
  Pause,
  Play,
  Radar,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { useScannerSimulation } from "@/hooks/use-scanner-simulation";
import { STAGE_META } from "@/data/mock/scanner";
import { formatBlock, formatClock, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScannerOutcome } from "@/types";

const OUTCOME_STYLE: Record<
  ScannerOutcome,
  { bar: string; badge: "lime" | "muted" | "white" }
> = {
  match: { bar: "bg-lime", badge: "lime" },
  skipped: { bar: "bg-grey-soft", badge: "muted" },
  info: { bar: "bg-blue", badge: "white" },
};

export function ScannerConsole() {
  const { running, state, events, toggle, reset } = useScannerSimulation();

  const stats = [
    { k: "Last scanned block", v: formatBlock(state.lastScannedBlock) },
    { k: "Chain head", v: formatBlock(state.chainHeadBlock) },
    { k: "Announcements processed", v: formatCount(state.announcementsProcessed) },
    { k: "View-tag matches", v: formatCount(state.viewTagMatches) },
    { k: "Payments detected", v: formatCount(state.paymentsDetected) },
    {
      k: "Last scan (UTC)",
      v: state.lastScanAt ? formatClock(state.lastScanAt) : "—",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="border-ink shadow-brutal-md border-[3px] bg-white">
        <div className="border-ink bg-ink text-paper flex flex-wrap items-center justify-between gap-4 border-b-[3px] p-5">
          <div className="flex items-center gap-3">
            <span className="border-paper bg-lime text-ink grid size-11 shrink-0 place-items-center border-2">
              <Radar
                className={cn("size-5", running && "animate-blink")}
                aria-hidden="true"
              />
            </span>
            <div>
              <SectionLabel className="text-lime">Scanner status</SectionLabel>
              <p
                className="font-display mt-1 flex items-center gap-2 text-base font-bold"
                aria-live="polite"
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0",
                    running ? "bg-lime animate-blink" : "bg-coral",
                  )}
                  aria-hidden="true"
                />
                {running ? "Scanning" : "Paused"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="coral" size="md">
              Simulation mode
            </Badge>
            <Button variant="secondary" size="sm" onClick={toggle}>
              {running ? (
                <Pause className="size-3.5" aria-hidden="true" />
              ) : (
                <Play className="size-3.5" aria-hidden="true" />
              )}
              {running ? "Pause" : "Resume"}
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Reset
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s, i) => (
            <div
              key={s.k}
              className={cn(
                "border-ink/15 p-4",
                i < stats.length - 1 && "border-b-2 sm:border-r-2",
                i >= 3 && "sm:border-b-0",
              )}
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
      </div>

      {/* Pipeline */}
      <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
        <SectionLabel className="text-grey">Detection pipeline</SectionLabel>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(STAGE_META)
            .sort((a, b) => a[1].order - b[1].order)
            .map(([stage, meta]) => (
              <li
                key={stage}
                className="border-ink bg-paper-2 flex items-start gap-3 border-2 p-3"
              >
                <span className="border-ink font-display grid size-7 shrink-0 place-items-center border-2 bg-white text-xs font-bold">
                  {meta.order}
                </span>
                <div>
                  <p className="font-display text-xs leading-tight font-bold">
                    {meta.label}
                  </p>
                  <p className="text-grey mt-0.5 font-mono text-[0.65rem]">
                    {stage}
                  </p>
                </div>
              </li>
            ))}
        </ol>
        <p className="text-grey mt-4 text-xs leading-relaxed">
          Most announcements belong to other receivers and exit at the view-tag
          check — which is exactly why the view tag exists. Only survivors reach
          the more expensive elliptic-curve derivation.
        </p>
      </div>

      {/* Live feed */}
      <div className="border-ink shadow-brutal border-2 bg-white">
        <div className="border-ink bg-paper-2 flex flex-wrap items-center justify-between gap-3 border-b-2 p-4">
          <SectionLabel className="text-grey">Event feed</SectionLabel>
          <Badge tone="white" size="sm">
            {events.length} events buffered
          </Badge>
        </div>

        <ul
          className="max-h-[32rem] divide-y-2 divide-ink/10 overflow-y-auto"
          aria-live="polite"
          aria-label="Scanner event feed"
        >
          {events.map((e) => {
            const style = OUTCOME_STYLE[e.outcome];
            return (
              <li
                key={e.id}
                className="animate-feed-in flex items-stretch gap-0"
              >
                <span
                  className={cn("w-1.5 shrink-0", style.bar)}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={style.badge} size="xs">
                      {e.outcome === "match" ? (
                        <CircleCheck className="size-2.5" aria-hidden="true" />
                      ) : e.outcome === "skipped" ? (
                        <CircleSlash className="size-2.5" aria-hidden="true" />
                      ) : null}
                      {STAGE_META[e.stage].label}
                    </Badge>
                    <span className="text-grey font-mono text-[0.65rem]">
                      block {formatBlock(e.blockNumber)}
                    </span>
                    <span className="text-grey ml-auto font-mono text-[0.65rem]">
                      {formatClock(e.timestamp)}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm leading-snug font-medium">
                    {e.message}
                  </p>
                  <p className="text-grey mt-0.5 font-mono text-[0.7rem] break-all">
                    {e.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
