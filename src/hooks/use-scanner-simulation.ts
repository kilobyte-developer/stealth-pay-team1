"use client";

import * as React from "react";
import {
  INITIAL_SCANNER_STATE,
  SEED_EVENTS,
  buildAnnouncementCycle,
} from "@/data/mock/scanner";
import type { ScannerEvent, ScannerState } from "@/types";

const MAX_FEED = 40;
const TICK_MS = 1400;

/**
 * Drives the Scanner page's simulated announcement feed.
 *
 * Nothing here touches the network: it emits scripted pipeline events so the
 * detection flow can be demonstrated and reviewed. The initial render uses
 * fixed seed data so server and client markup match, and the interval only
 * starts after mount.
 */
export function useScannerSimulation() {
  const [running, setRunning] = React.useState(true);
  const [state, setState] = React.useState<ScannerState>(INITIAL_SCANNER_STATE);
  const [events, setEvents] = React.useState<ScannerEvent[]>(() =>
    [...SEED_EVENTS].reverse(),
  );

  const queue = React.useRef<ScannerEvent[]>([]);
  const cycle = React.useRef(1);
  const block = React.useRef(INITIAL_SCANNER_STATE.lastScannedBlock);

  React.useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      if (queue.current.length === 0) {
        block.current += 1 + (cycle.current % 3);
        queue.current = buildAnnouncementCycle(
          cycle.current,
          block.current,
          new Date().toISOString(),
        );
        cycle.current += 1;
      }

      const next = queue.current.shift();
      if (!next) return;

      setEvents((prev) => [next, ...prev].slice(0, MAX_FEED));

      setState((prev) => ({
        ...prev,
        running: true,
        lastScannedBlock: Math.max(prev.lastScannedBlock, next.blockNumber),
        chainHeadBlock: Math.max(
          prev.chainHeadBlock,
          next.blockNumber + 4,
        ),
        announcementsProcessed:
          next.stage === "announcement"
            ? prev.announcementsProcessed + 1
            : prev.announcementsProcessed,
        viewTagMatches:
          next.stage === "view-tag" && next.outcome === "match"
            ? prev.viewTagMatches + 1
            : prev.viewTagMatches,
        paymentsDetected:
          next.stage === "verify"
            ? prev.paymentsDetected + 1
            : prev.paymentsDetected,
        lastScanAt: next.timestamp,
      }));
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [running]);

  const toggle = React.useCallback(() => {
    setRunning((r) => {
      setState((s) => ({ ...s, running: !r }));
      return !r;
    });
  }, []);

  const reset = React.useCallback(() => {
    queue.current = [];
    cycle.current = 1;
    block.current = INITIAL_SCANNER_STATE.lastScannedBlock;
    setEvents([...SEED_EVENTS].reverse());
    setState(INITIAL_SCANNER_STATE);
    setRunning(true);
  }, []);

  return { running, state, events, toggle, reset };
}
