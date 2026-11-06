import type { ScannerEvent, ScannerStage, ScannerState } from "@/types";

/* ============================================================================
   DEMO DATA — SIMULATED SCANNER.
   This module fabricates an announcement-processing feed so the Scanner page
   can show the shape of ERC-5564 detection. It performs no RPC calls, reads no
   logs, and has no access to any viewing key.
   ========================================================================== */

export const INITIAL_SCANNER_STATE: ScannerState = {
  running: true,
  lastScannedBlock: 38_413_118,
  chainHeadBlock: 38_413_204,
  announcementsProcessed: 1_284,
  viewTagMatches: 9,
  paymentsDetected: 4,
  lastScanAt: "2026-11-05T16:44:00.000Z",
};

export const STAGE_META: Record<
  ScannerStage,
  { label: string; order: number }
> = {
  announcement: { label: "Announcement read", order: 1 },
  ephemeral: { label: "Ephemeral key extracted", order: 2 },
  "view-tag": { label: "View tag evaluated", order: 3 },
  derive: { label: "Stealth address derived", order: 4 },
  match: { label: "Payment matched", order: 5 },
  verify: { label: "Transfer verified", order: 6 },
};

/** Rendered on first paint — fixed values keep server and client markup identical. */
export const SEED_EVENTS: ScannerEvent[] = [
  {
    id: "seed-1",
    stage: "announcement",
    outcome: "info",
    message: "Announcement read from block 38,413,114",
    detail: "schemeId=1 · caller=0xC37d…73cB",
    blockNumber: 38_413_114,
    timestamp: "2026-11-05T16:43:28.000Z",
  },
  {
    id: "seed-2",
    stage: "view-tag",
    outcome: "skipped",
    message: "View tag mismatch — skipped",
    detail: "expected 0x4b · announced 0xd1",
    blockNumber: 38_413_114,
    timestamp: "2026-11-05T16:43:29.000Z",
  },
  {
    id: "seed-3",
    stage: "announcement",
    outcome: "info",
    message: "Announcement read from block 38,413,118",
    detail: "schemeId=1 · caller=0xE41b…C72a",
    blockNumber: 38_413_118,
    timestamp: "2026-11-05T16:43:52.000Z",
  },
  {
    id: "seed-4",
    stage: "ephemeral",
    outcome: "info",
    message: "Ephemeral public key extracted",
    detail: "R=0x02a71c4e…395f62",
    blockNumber: 38_413_118,
    timestamp: "2026-11-05T16:43:53.000Z",
  },
  {
    id: "seed-5",
    stage: "view-tag",
    outcome: "match",
    message: "View tag matched 0x19",
    detail: "proceeding to full derivation",
    blockNumber: 38_413_118,
    timestamp: "2026-11-05T16:43:54.000Z",
  },
  {
    id: "seed-6",
    stage: "derive",
    outcome: "info",
    message: "Derived candidate P' = B + H(a·R)·G",
    detail: "0xB62f14D9a05C73e8126bF4A9d38E750c91Ad6F23",
    blockNumber: 38_413_118,
    timestamp: "2026-11-05T16:43:55.000Z",
  },
  {
    id: "seed-7",
    stage: "match",
    outcome: "match",
    message: "Candidate matches announced stealth address",
    detail: "0xB62f…6F23",
    blockNumber: 38_413_118,
    timestamp: "2026-11-05T16:43:56.000Z",
  },
  {
    id: "seed-8",
    stage: "verify",
    outcome: "match",
    message: "On-chain transfer verified — 0.75 AVAX",
    detail: "announcement alone is never treated as proof of payment",
    blockNumber: 38_413_118,
    timestamp: "2026-11-05T16:43:57.000Z",
  },
];

const CALLERS = ["0xC37d…73cB", "0xE41b…C72a", "0x8b14…A902", "0x41dC…77Fe"];
const TAGS = ["0xd1", "0x93", "0x2f", "0xbc", "0x07", "0x6a"];
const EPHEMERALS = [
  "R=0x0273f5c2…51c9b8",
  "R=0x03b4e82d…f91b38",
  "R=0x02a71c4e…395f62",
  "R=0x033d08c5…526b9f3",
];

/** Deterministic pseudo-random so repeated runs look consistent. */
function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Builds the event sequence for processing one announcement. Most announcements
 * belong to other receivers and exit at the view-tag check — which is exactly
 * why the view tag exists.
 */
export function buildAnnouncementCycle(
  index: number,
  blockNumber: number,
  nowIso: string,
): ScannerEvent[] {
  const r = seeded(index);
  const isMatch = index % 5 === 0;
  const caller = CALLERS[index % CALLERS.length];
  const base = `c${index}`;

  const events: ScannerEvent[] = [
    {
      id: `${base}-a`,
      stage: "announcement",
      outcome: "info",
      message: `Announcement read from block ${blockNumber.toLocaleString("en-US")}`,
      detail: `schemeId=1 · caller=${caller}`,
      blockNumber,
      timestamp: nowIso,
    },
  ];

  if (!isMatch) {
    events.push({
      id: `${base}-skip`,
      stage: "view-tag",
      outcome: "skipped",
      message: "View tag mismatch — skipped",
      detail: `expected 0x4b · announced ${TAGS[Math.floor(r * TAGS.length)]}`,
      blockNumber,
      timestamp: nowIso,
    });
    return events;
  }

  const amount = (0.25 + Math.floor(r * 40) / 10).toFixed(2);

  events.push(
    {
      id: `${base}-e`,
      stage: "ephemeral",
      outcome: "info",
      message: "Ephemeral public key extracted",
      detail: EPHEMERALS[index % EPHEMERALS.length],
      blockNumber,
      timestamp: nowIso,
    },
    {
      id: `${base}-t`,
      stage: "view-tag",
      outcome: "match",
      message: "View tag matched 0x4b",
      detail: "proceeding to full derivation",
      blockNumber,
      timestamp: nowIso,
    },
    {
      id: `${base}-d`,
      stage: "derive",
      outcome: "info",
      message: "Derived candidate P' = B + H(a·R)·G",
      detail: "comparing against announced stealth address",
      blockNumber,
      timestamp: nowIso,
    },
    {
      id: `${base}-m`,
      stage: "match",
      outcome: "match",
      message: "Candidate matches announced stealth address",
      detail: "payment belongs to this identity",
      blockNumber,
      timestamp: nowIso,
    },
    {
      id: `${base}-v`,
      stage: "verify",
      outcome: "match",
      message: `On-chain transfer verified — ${amount} AVAX`,
      detail: "announcement alone is never treated as proof of payment",
      blockNumber,
      timestamp: nowIso,
    },
  );

  return events;
}
