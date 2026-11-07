"use client";

import * as React from "react";
import { getLocalActivity, type LocalActivityEntry } from "@/lib/activity/local-log";
import type { NetworkKey } from "@/types";

/**
 * This browser's recorded sends and forwards for `network`. Re-reads
 * localStorage on demand via `refresh()` — there is no storage-change event
 * to subscribe to across components, so callers that just performed a send
 * or forward call `refresh()` themselves rather than relying on polling.
 */
export function useLocalActivity(network: NetworkKey) {
  const [entries, setEntries] = React.useState<LocalActivityEntry[]>(() =>
    getLocalActivity(network),
  );
  // Re-reads when `network` itself changes, during render rather than in an
  // effect — an extra render on a network switch is cheaper and simpler than
  // the mount-then-immediately-re-render an effect would cause here.
  const [syncedNetwork, setSyncedNetwork] = React.useState(network);
  if (network !== syncedNetwork) {
    setSyncedNetwork(network);
    setEntries(getLocalActivity(network));
  }

  const refresh = React.useCallback(() => {
    setEntries(getLocalActivity(network));
  }, [network]);

  return { entries, refresh };
}
