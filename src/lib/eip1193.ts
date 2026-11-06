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

  /*
   * Ask repeatedly, not once.
   *
   * A wallet only announces in response to `eip6963:requestProvider`. Extension
   * content scripts frequently attach their listener AFTER the app hydrates, so
   * a single dispatch at mount can land before anything is listening — and then
   * no wallet is ever discovered. Re-asking on a short schedule, plus on `load`
   * and when the tab becomes visible, closes that race.
   */
  const request = () => window.dispatchEvent(new Event("eip6963:requestProvider"));
  request();

  const delays = [50, 150, 400, 800, 1500, 2500];
  const timers = delays.map((ms) => window.setTimeout(request, ms));

  window.addEventListener("load", request);
  document.addEventListener("visibilitychange", request);

  return () => {
    window.removeEventListener("eip6963:announceProvider", handler);
    window.removeEventListener("load", request);
    document.removeEventListener("visibilitychange", request);
    for (const t of timers) window.clearTimeout(t);
  };
}

/** Re-asks wallets to announce themselves. */
export function requestProviderAnnouncements(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

/** Legacy injected provider shape, pre-EIP-6963. */
interface LegacyEthereumProvider extends Eip1193Provider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isAvalanche?: boolean;
  /** Some environments expose several wallets here. */
  providers?: LegacyEthereumProvider[];
}

function labelLegacyProvider(provider: LegacyEthereumProvider): string {
  if (provider.isAvalanche) return "Core";
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isRabby) return "Rabby";
  if (provider.isBraveWallet) return "Brave Wallet";
  return "Injected wallet";
}

/**
 * Fallback discovery via `window.ethereum`.
 *
 * EIP-6963 is the modern path, but plenty of wallets still only expose the
 * legacy global: older extension builds, mobile in-app browsers, and some
 * Brave configurations. Without this, those users simply cannot connect.
 *
 * Returns synthesized details shaped like EIP-6963 announcements so the rest of
 * the wallet layer needs no special-casing.
 */
export function getLegacyProviders(): Eip6963ProviderDetail[] {
  if (typeof window === "undefined") return [];

  const root = (window as { ethereum?: LegacyEthereumProvider }).ethereum;
  if (!root || typeof root.request !== "function") return [];

  // `providers` is the multi-wallet convention; otherwise it is a single one.
  const candidates =
    Array.isArray(root.providers) && root.providers.length > 0
      ? root.providers
      : [root];

  return candidates
    .filter((p) => p && typeof p.request === "function")
    .map((provider, index) => ({
      info: {
        uuid: `legacy:${index}`,
        name: labelLegacyProvider(provider),
        icon: "",
        rdns: `legacy.injected.${index}`,
      },
      provider,
    }));
}
