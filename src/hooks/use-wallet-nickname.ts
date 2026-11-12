"use client";

import * as React from "react";
import {
  getWalletNicknameRaw,
  markWalletNicknamePrompted,
  parseWalletNicknameRaw,
  setWalletNickname,
} from "@/lib/wallet/nickname-storage";

const EMPTY_RAW = "";

// A tiny pub/sub so every mounted instance of this hook re-reads storage
// after a save/skip, without polling or an effect-driven setState.
const listeners = new Set<() => void>();
function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}
function notify() {
  for (const listener of listeners) listener();
}

/**
 * A per-address nickname saved only in this browser. `prompted` tracks
 * whether this address has already been asked to be named (named or
 * skipped), so the "name this account?" popup only ever appears once per
 * address, not on every reconnect.
 */
export function useWalletNickname(address: string | null) {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => (address ? getWalletNicknameRaw(address) : EMPTY_RAW),
    () => EMPTY_RAW,
  );

  const record = React.useMemo(
    () =>
      address ? parseWalletNicknameRaw(raw) : { name: null, prompted: true },
    [address, raw],
  );

  const saveName = React.useCallback(
    (value: string) => {
      if (!address) return;
      setWalletNickname(address, value);
      notify();
    },
    [address],
  );

  const dismiss = React.useCallback(() => {
    if (!address) return;
    markWalletNicknamePrompted(address);
    notify();
  }, [address]);

  return { name: record.name, prompted: record.prompted, saveName, dismiss };
}
