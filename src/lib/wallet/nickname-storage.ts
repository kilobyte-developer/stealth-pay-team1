/**
 * A nickname for a connected wallet account, saved only in this browser via
 * `localStorage` — never sent anywhere, never tied to the stealth identity or
 * any key material. Purely a display label for the connected EOA address.
 */

const STORAGE_PREFIX = "stealthpay:wallet-nickname";

interface StoredNickname {
  name: string | null;
  /** True once the user has been asked to name this address (named or skipped). */
  prompted: boolean;
}

function storageKey(address: string): string {
  return `${STORAGE_PREFIX}:${address.toLowerCase()}`;
}

/** Raw stored JSON for an address, or `""` if unset/unavailable — the value
 *  `useWalletNickname` subscribes to via `useSyncExternalStore`, since a
 *  string (unlike a freshly-parsed object) compares stably across reads. */
export function getWalletNicknameRaw(address: string): string {
  try {
    return window.localStorage.getItem(storageKey(address)) ?? "";
  } catch {
    return "";
  }
}

export function parseWalletNicknameRaw(raw: string): StoredNickname {
  if (!raw) return { name: null, prompted: false };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredNickname>;
    return {
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name
          : null,
      prompted: parsed.prompted === true,
    };
  } catch {
    return { name: null, prompted: false };
  }
}

export function getWalletNickname(address: string): StoredNickname {
  return parseWalletNicknameRaw(getWalletNicknameRaw(address));
}

/** Saves a chosen nickname and marks the address as prompted. */
export function setWalletNickname(address: string, name: string): void {
  try {
    const record: StoredNickname = { name, prompted: true };
    window.localStorage.setItem(storageKey(address), JSON.stringify(record));
  } catch {
    /* Saving a nickname is optional — the address still displays fine. */
  }
}

/** Marks the address as prompted without setting a name (the user skipped). */
export function markWalletNicknamePrompted(address: string): void {
  try {
    const existing = getWalletNickname(address);
    const record: StoredNickname = { name: existing.name, prompted: true };
    window.localStorage.setItem(storageKey(address), JSON.stringify(record));
  } catch {
    /* Nothing to persist — the popup may just reappear next time. */
  }
}
