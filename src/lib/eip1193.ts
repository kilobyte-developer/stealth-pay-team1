/**
 * Minimal EIP-1193 / EIP-6963 typings.
 *
 * StealthPay's wallet layer talks to injected wallets directly rather than
 * through a connector library. For this UI milestone the only operations
 * needed are: list wallets, request accounts, read the chain id, and request a
 * chain switch. When contract calls land, this module is the seam where a
 * fuller connector stack (see TECH_STACK.md §10) can be introduced.
 */

export interface Eip1193RequestArgs {
  method: string;
  params?: readonly unknown[] | object;
}

export interface Eip1193Provider {
  request<T = unknown>(args: Eip1193RequestArgs): Promise<T>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

interface Eip6963AnnounceEvent extends CustomEvent {
  detail: Eip6963ProviderDetail;
}

/** Provider-rejected-request code from EIP-1193. */
export const USER_REJECTED = 4001;
/** Chain not recognised by the wallet — EIP-3085 add-chain is required. */
export const CHAIN_NOT_ADDED = 4902;

export function errorCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "number") return code;
  }
  return undefined;
}

export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unexpected wallet error.";
}

/**
 * Discovers injected wallets via EIP-6963. Returns an unsubscribe function.
 * Wallets announce in response to `eip6963:requestProvider`, so new entries can
 * arrive slightly after the first call.
 */
export function discoverProviders(
  onDetail: (detail: Eip6963ProviderDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const detail = (event as Eip6963AnnounceEvent).detail;
    if (detail?.info?.uuid && detail.provider) onDetail(detail);
  };

  window.addEventListener("eip6963:announceProvider", handler);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  return () => window.removeEventListener("eip6963:announceProvider", handler);
}

/** Known wallet hints used to label an unnamed legacy `window.ethereum`. */
export const WALLET_HINTS: Record<string, string> = {
  "io.metamask": "MetaMask",
  "app.core.extension": "Core",
  "com.coinbase.wallet": "Coinbase Wallet",
  "com.brave.wallet": "Brave Wallet",
  "io.rabby": "Rabby",
};
