"use client";

import * as React from "react";
import { CONTRACTS, SCAN_START_BLOCK } from "@/config/networks";
import {
  scanAnnouncements,
  type DetectedPayment,
  type ScanProgress,
} from "@/lib/scanner/announcement-scanner";
import { useActiveNetwork } from "@/providers/wallet-provider";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";

/** Why payment data is unavailable, when it is. */
export type PaymentsUnavailableReason =
  | "identity-locked"
  | "announcer-not-configured";

export interface StealthPaymentsState {
  status: "unavailable" | "scanning" | "ready" | "error";
  reason: PaymentsUnavailableReason | null;
  payments: DetectedPayment[];
  progress: ScanProgress | null;
  lastScannedBlock: bigint | null;
  headBlock: bigint | null;
  announcementsSeen: number;
  viewTagMatches: number;
  error: string | null;
  rescan: () => void;
}

interface ScanState {
  phase: "scanning" | "ready" | "error";
  payments: DetectedPayment[];
  progress: ScanProgress | null;
  lastScannedBlock: bigint | null;
  headBlock: bigint | null;
  announcementsSeen: number;
  viewTagMatches: number;
  error: string | null;
}

const INITIAL: ScanState = {
  phase: "scanning",
  payments: [],
  progress: null,
  lastScannedBlock: null,
  headBlock: null,
  announcementsSeen: 0,
  viewTagMatches: 0,
  error: null,
};

/**
 * Detected stealth payments, read from the chain.
 *
 * Requires two things, and says which is missing rather than inventing data:
 *   - an unlocked identity, because matching needs the private viewing key;
 *   - a configured Announcer address, because there is nothing to read without it.
 *
 * The private viewing key never reaches the scanner: matching is handed over as
 * a callback owned by the identity provider.
 *
 * The "unavailable" state is DERIVED from those prerequisites rather than
 * written into state, so the effect only ever runs when a scan is genuinely
 * possible and never has to reset synchronously.
 */
export function useStealthPayments(): StealthPaymentsState {
  const network = useActiveNetwork();
  const { publicIdentity, checkAnnouncement } = useStealthIdentity();
  const announcer = CONTRACTS[network].announcer;

  const [scan, setScan] = React.useState<ScanState>(INITIAL);
  const [nonce, setNonce] = React.useState(0);

  const rescan = React.useCallback(() => setNonce((n) => n + 1), []);

  const reason: PaymentsUnavailableReason | null = !publicIdentity
    ? "identity-locked"
    : !announcer
      ? "announcer-not-configured"
      : null;

  const canScan = reason === null && announcer !== null;

  React.useEffect(() => {
    if (!canScan || !announcer) return;

    const controller = new AbortController();
    setScan({ ...INITIAL, phase: "scanning" });

    void (async () => {
      try {
        const result = await scanAnnouncements({
          network,
          announcer,
          fromBlock: SCAN_START_BLOCK[network],
          match: (input) => checkAnnouncement(input),
          onProgress: (progress) => {
            if (controller.signal.aborted) return;
            setScan((prev) => ({ ...prev, progress }));
          },
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setScan({
          phase: "ready",
          payments: result.payments,
          progress: null,
          lastScannedBlock: result.lastScannedBlock,
          headBlock: result.headBlock,
          announcementsSeen: result.announcementsSeen,
          viewTagMatches: result.viewTagMatches,
          error: null,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setScan((prev) => ({
          ...prev,
          phase: "error",
          error:
            err instanceof Error
              ? err.message
              : "Could not scan announcements.",
        }));
      }
    })();

    return () => controller.abort();
  }, [canScan, announcer, network, checkAnnouncement, nonce]);

  if (!canScan) {
    return {
      status: "unavailable",
      reason,
      payments: [],
      progress: null,
      lastScannedBlock: null,
      headBlock: null,
      announcementsSeen: 0,
      viewTagMatches: 0,
      error: null,
      rescan,
    };
  }

  return {
    status: scan.phase,
    reason: null,
    payments: scan.payments,
    progress: scan.progress,
    lastScannedBlock: scan.lastScannedBlock,
    headBlock: scan.headBlock,
    announcementsSeen: scan.announcementsSeen,
    viewTagMatches: scan.viewTagMatches,
    error: scan.error,
    rescan,
  };
}
