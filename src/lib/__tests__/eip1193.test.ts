// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverProviders,
  getLegacyProviders,
  requestProviderAnnouncements,
  type Eip1193Provider,
  type Eip6963ProviderDetail,
} from "../eip1193";

function fakeProvider(extra: Record<string, unknown> = {}): Eip1193Provider {
  return {
    request: vi.fn(async () => undefined),
    ...extra,
  } as unknown as Eip1193Provider;
}

/**
 * Registers a wallet that announces itself in response to
 * `eip6963:requestProvider` — but only starts listening after `attachAfterMs`,
 * which is what real extensions do when their content script loads late.
 */
function mountLateWallet(name: string, attachAfterMs: number) {
  const provider = fakeProvider();
  let listener: (() => void) | null = null;

  const timer = setTimeout(() => {
    listener = () => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: `uuid-${name}`, name, icon: "", rdns: `io.${name}` },
            provider,
          },
        }),
      );
    };
    // Responds ONLY to `requestProvider` — deliberately does not self-announce
    // on attach. This models the worst case, which is the case that was broken:
    // if the app never asks again, this wallet is never found.
    window.addEventListener("eip6963:requestProvider", listener);
  }, attachAfterMs);

  return () => {
    clearTimeout(timer);
    if (listener) {
      window.removeEventListener("eip6963:requestProvider", listener);
    }
  };
}

afterEach(() => {
  delete (window as { ethereum?: unknown }).ethereum;
});

describe("EIP-6963 discovery", () => {
  it("finds a wallet that only starts listening after the app mounts", async () => {
    // This is the exact failure mode that broke wallet connection: a single
    // `requestProvider` dispatch at mount lands before the extension is
    // listening, so nothing is ever discovered.
    const unmount = mountLateWallet("latewallet", 300);
    const found: Eip6963ProviderDetail[] = [];

    const stop = discoverProviders((d) => found.push(d));

    // Nothing yet — the wallet is not listening at t=0.
    expect(found).toHaveLength(0);

    await new Promise((r) => setTimeout(r, 1200));

    expect(found.map((f) => f.info.name)).toContain("latewallet");

    stop();
    unmount();
  });

  it("finds a wallet that is already listening", async () => {
    const unmount = mountLateWallet("eagerwallet", 0);
    const found: Eip6963ProviderDetail[] = [];
    const stop = discoverProviders((d) => found.push(d));

    await new Promise((r) => setTimeout(r, 200));
    expect(found.map((f) => f.info.name)).toContain("eagerwallet");

    stop();
    unmount();
  });

  it("a SINGLE request would have missed the late wallet (regression guard)", async () => {
    // Reproduces the original bug to prove the retry is load-bearing rather
    // than incidental: ask exactly once, as the old implementation did.
    const unmount = mountLateWallet("latewallet2", 300);
    const found: Eip6963ProviderDetail[] = [];

    const handler = (event: Event) => {
      found.push((event as CustomEvent).detail as Eip6963ProviderDetail);
    };
    window.addEventListener("eip6963:announceProvider", handler);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    await new Promise((r) => setTimeout(r, 1200));

    // Nothing found — exactly the reported symptom.
    expect(found).toHaveLength(0);

    window.removeEventListener("eip6963:announceProvider", handler);
    unmount();
  });

  it("stops asking once unsubscribed", async () => {
    const found: Eip6963ProviderDetail[] = [];
    const stop = discoverProviders((d) => found.push(d));
    stop();

    // A wallet that attaches after teardown must not reach the callback.
    const unmount = mountLateWallet("toolate", 100);
    await new Promise((r) => setTimeout(r, 600));

    expect(found).toHaveLength(0);
    unmount();
  });

  it("requestProviderAnnouncements re-asks without throwing", () => {
    expect(() => requestProviderAnnouncements()).not.toThrow();
  });
});

describe("Legacy window.ethereum fallback", () => {
  it("returns nothing when no wallet is present", () => {
    expect(getLegacyProviders()).toEqual([]);
  });

  it("discovers a single legacy provider and labels MetaMask", () => {
    (window as { ethereum?: unknown }).ethereum = fakeProvider({
      isMetaMask: true,
    });

    const found = getLegacyProviders();
    expect(found).toHaveLength(1);
    expect(found[0].info.name).toBe("MetaMask");
    expect(found[0].info.uuid).toBe("legacy:0");
  });

  it("labels Core via isAvalanche", () => {
    (window as { ethereum?: unknown }).ethereum = fakeProvider({
      isAvalanche: true,
    });
    expect(getLegacyProviders()[0].info.name).toBe("Core");
  });

  it("falls back to a generic label for an unknown wallet", () => {
    (window as { ethereum?: unknown }).ethereum = fakeProvider();
    expect(getLegacyProviders()[0].info.name).toBe("Injected wallet");
  });

  it("enumerates the multi-wallet providers array", () => {
    (window as { ethereum?: unknown }).ethereum = fakeProvider({
      isMetaMask: true,
      providers: [
        fakeProvider({ isMetaMask: true }),
        fakeProvider({ isCoinbaseWallet: true }),
      ],
    });

    const found = getLegacyProviders();
    expect(found).toHaveLength(2);
    expect(found.map((f) => f.info.name)).toEqual([
      "MetaMask",
      "Coinbase Wallet",
    ]);
    // Distinct uuids, so the UI can key and select them.
    expect(new Set(found.map((f) => f.info.uuid)).size).toBe(2);
  });

  it("ignores a global that is not a usable provider", () => {
    (window as { ethereum?: unknown }).ethereum = { notAProvider: true };
    expect(getLegacyProviders()).toEqual([]);
  });

  it("exposes the real provider object so connect() can call it", async () => {
    const provider = fakeProvider({ isMetaMask: true });
    (window as { ethereum?: unknown }).ethereum = provider;

    const found = getLegacyProviders();
    await found[0].provider.request({ method: "eth_requestAccounts" });
    expect(provider.request).toHaveBeenCalledWith({
      method: "eth_requestAccounts",
    });
  });
});
