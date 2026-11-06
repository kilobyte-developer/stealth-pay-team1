import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { formatBlock, formatCount, formatDateTime } from "@/lib/format";
import { INITIAL_SCANNER_STATE } from "@/data/mock/scanner";

export function ScannerStatusCard() {
  const s = INITIAL_SCANNER_STATE;

  const rows = [
    { k: "Last scanned block", v: formatBlock(s.lastScannedBlock) },
    { k: "Announcements processed", v: formatCount(s.announcementsProcessed) },
    { k: "View-tag matches", v: formatCount(s.viewTagMatches) },
    { k: "Payments detected", v: formatCount(s.paymentsDetected) },
  ];

  return (
    <div className="border-ink bg-ink text-paper shadow-brutal border-[3px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="border-paper bg-lime text-ink grid size-10 shrink-0 place-items-center border-2">
            <Radar className="size-5" aria-hidden="true" />
          </span>
          <div>
            <SectionLabel className="text-lime">Stealth scanner</SectionLabel>
            <p className="font-display mt-1 flex items-center gap-2 text-sm font-bold">
              <span
                className="bg-lime animate-blink size-2.5 shrink-0"
                aria-hidden="true"
              />
              Active
            </p>
          </div>
        </div>
        <Badge tone="coral" size="sm">
          Simulation
        </Badge>
      </div>

      <dl className="mt-5 space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.k}
            className="border-paper/20 flex items-baseline justify-between gap-3 border-b-2 pb-2.5 last:border-b-0 last:pb-0"
          >
            <dt className="text-paper/70 text-xs">{r.k}</dt>
            <dd className="font-display text-sm font-bold">{r.v}</dd>
          </div>
        ))}
      </dl>

      <p className="text-paper/55 mt-4 text-[0.7rem] leading-relaxed">
        Last scan {s.lastScanAt ? formatDateTime(s.lastScanAt) : "—"}. These
        counters are simulated: no RPC log scanning is running and no viewing key
        is loaded.
      </p>

      <Link
        href="/scanner"
        className="border-paper hover:bg-lime hover:text-ink font-display mt-5 inline-flex items-center gap-2 border-2 px-3 py-2 text-[0.7rem] font-bold tracking-wide uppercase transition-colors"
      >
        Open scanner
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
