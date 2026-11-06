"use client";

import * as React from "react";
import {
  CHAIN_NOT_ADDED,
  USER_REJECTED,
  discoverProviders,
  errorCode,
  errorMessage,
  getLegacyProviders,
  requestProviderAnnouncements,
  type Eip1193Provider,
  type Eip6963ProviderDetail,
} from "@/lib/eip1193";
import {
  createWalletClient,
  custom,
  type EIP1193Provider,
  type WalletClient,
} from "viem";
import {
  DEFAULT_NETWORK,
  NETWORKS,
  networkByChainId,
  toHexChainId,
} from "@/config/networks";
import { getChain } from "@/lib/chain/client";
import type { Hex, NetworkKey } from "@/types";

const LAST_WALLET_KEY = "stealthpay:last-wallet-rdns";

export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "switching";

interface WalletContextValue {
  status: WalletStatus;
  address: Hex | null;
  chainId: number | null;
  walletName: string | null;
  /**
   * Wallets discovered in this browser — EIP-6963 announcements when present,
   * otherwise the legacy `window.ethereum` global. Empty means none found.
   */
  available: Eip6963ProviderDetail[];
  /** True when the legacy global is being used because nothing announced. */
  usingLegacyProvider: boolean;
  error: string | null;
  /** True when connected to a chain StealthPay does not support. */
  unsupportedChain: boolean;
  connect: (uuid: string) => Promise<void>;
  disconnect: () => void;
  switchNetwork: (key: NetworkKey) => Promise<void>;
  /** Re-asks wallets to announce, for the "scan again" affordance. */
  rescan: () => void;
  /**
   * A viem wallet client over the connected EIP-1193 provider, for signing.
   * Null when no wallet is connected or the chain is unsupported.
   */
  getWalletClient: () => WalletClient | null;
  clearError: () => void;
}

const WalletContext = React.createContext<WalletContextValue | null>(null);

export function useWallet() {
  const ctx = React.useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<WalletStatus>("disconnected");
  const [address, setAddress] = React.useState<Hex | null>(null);
  const [chainId, setChainId] = React.useState<number | null>(null);
  const [walletName, setWalletName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const activeProvider = React.useRef<Eip1193Provider | null>(null);

  /* ---- Wallet discovery ---- */
  const [announced, setAnnounced] = React.useState<Eip6963ProviderDetail[]>([]);
  const [legacy, setLegacy] = React.useState<Eip6963ProviderDetail[]>([]);

  React.useEffect(() => {
    const stop = discoverProviders((detail) => {
      setAnnounced((prev) =>
        prev.some((p) => p.info.uuid === detail.info.uuid)
          ? prev
          : [...prev, detail],
      );
    });

    // Legacy `window.ethereum` is also polled briefly, because the global is
    // often injected a tick or two after first paint.
    const pickUpLegacy = () => setLegacy(getLegacyProviders());
    pickUpLegacy();
    const timers = [100, 400, 1200, 2500].map((ms) =>
      window.setTimeout(pickUpLegacy, ms),
    );

    return () => {
      stop();
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);

  /**
   * EIP-6963 announcements win. The legacy global is only surfaced when nothing
   * announced, so a wallet that supports both is not listed twice.
   */
  const available = React.useMemo(
    () => (announced.length > 0 ? announced : legacy),
    [announced, legacy],
  );

  const rescan = React.useCallback(() => {
    requestProviderAnnouncements();
    setLegacy(getLegacyProviders());
  }, []);

  /**
   * Wraps the connected EIP-1193 provider in a viem wallet client so callers
   * can sign and send transactions. Returns null unless the wallet is connected
   * to a chain StealthPay supports — signing against an unknown chain would
   * send a payment somewhere unintended.
   */
  const getWalletClient = React.useCallback((): WalletClient | null => {
    const provider = activeProvider.current;
    if (!provider || !address || chainId === null) return null;
    const network = networkByChainId(chainId);
    if (!network) return null;

    return createWalletClient({
      account: address,
      chain: getChain(network.key),
      transport: custom(provider as unknown as EIP1193Provider),
    });
  }, [address, chainId]);

  const reset = React.useCallback(() => {
    activeProvider.current = null;
    setAddress(null);
    setChainId(null);
    setWalletName(null);
    setStatus("disconnected");
  }, []);

  /* ---- Live account / chain subscriptions ---- */
  const attach = React.useCallback(
    (provider: Eip1193Provider) => {
      const onAccounts = (...args: never[]) => {
        const accounts = args[0] as unknown as string[] | undefined;
        if (!accounts || accounts.length === 0) {
          try {
            window.localStorage.removeItem(LAST_WALLET_KEY);
          } catch {
            /* storage unavailable — nothing to clean up */
          }
          reset();
        } else {
          setAddress(accounts[0] as Hex);
        }
      };

      const onChain = (...args: never[]) => {
        const next = args[0] as unknown as string | undefined;
        if (typeof next === "string") setChainId(Number.parseInt(next, 16));
      };

      provider.on?.("accountsChanged", onAccounts);
      provider.on?.("chainChanged", onChain);

      return () => {
        provider.removeListener?.("accountsChanged", onAccounts);
        provider.removeListener?.("chainChanged", onChain);
      };
    },
    [reset],
  );

  const detachRef = React.useRef<(() => void) | null>(null);

  const adopt = React.useCallback(
    async (detail: Eip6963ProviderDetail, accounts: string[]) => {
      detachRef.current?.();
      activeProvider.current = detail.provider;
      detachRef.current = attach(detail.provider);

      const hexChain = await detail.provider.request<string>({
        method: "eth_chainId",
      });

      setAddress(accounts[0] as Hex);
      setChainId(Number.parseInt(hexChain, 16));
      setWalletName(detail.info.name);
      setStatus("connected");
    },
    [attach],
  );

  /* ---- Silent reconnect to a wallet already authorised for this origin ---- */
  const triedEager = React.useRef(false);
  React.useEffect(() => {
    if (triedEager.current || available.length === 0) return;

    let lastRdns: string | null = null;
    try {
      lastRdns = window.localStorage.getItem(LAST_WALLET_KEY);
    } catch {
      lastRdns = null;
    }
    if (!lastRdns) return;

    const detail = available.find((p) => p.info.rdns === lastRdns);
    if (!detail) return;

    triedEager.current = true;
    void (async () => {
      try {
        // `eth_accounts` never prompts — it only reports existing permission.
        const accounts = await detail.provider.request<string[]>({
          method: "eth_accounts",
        });
        if (accounts.length > 0) await adopt(detail, accounts);
      } catch {
        /* Silent restore is best-effort; the user can connect manually. */
      }
    })();
  }, [available, adopt]);

  React.useEffect(() => () => detachRef.current?.(), []);

  /* ---- Actions ---- */
  const connect = React.useCallback(
    async (uuid: string) => {
      const detail = available.find((p) => p.info.uuid === uuid);
      if (!detail) {
        setError("That wallet is no longer available in this browser.");
        return;
      }

      setError(null);
      setStatus("connecting");
      try {
        const accounts = await detail.provider.request<string[]>({
          method: "eth_requestAccounts",
        });
        if (accounts.length === 0) {
          setStatus("disconnected");
          setError("No accounts were shared by the wallet.");
          return;
        }
        await adopt(detail, accounts);
        try {
          window.localStorage.setItem(LAST_WALLET_KEY, detail.info.rdns);
        } catch {
          /* Remembering the wallet is optional. */
        }
      } catch (err) {
        setStatus("disconnected");
        setError(
          errorCode(err) === USER_REJECTED
            ? "Connection request was rejected in the wallet."
            : errorMessage(err),
        );
      }
    },
    [available, adopt],
  );

  const disconnect = React.useCallback(() => {
    try {
      window.localStorage.removeItem(LAST_WALLET_KEY);
    } catch {
      /* nothing to clean up */
    }
    detachRef.current?.();
    detachRef.current = null;
    reset();
  }, [reset]);

  const switchNetwork = React.useCallback(async (key: NetworkKey) => {
    const provider = activeProvider.current;
    const network = NETWORKS[key];
    if (!provider) {
      setError("Connect a wallet before switching networks.");
      return;
    }

    setError(null);
    setStatus("switching");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHexChainId(network.chainId) }],
      });
      setChainId(network.chainId);
    } catch (err) {
      if (errorCode(err) === CHAIN_NOT_ADDED) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: toHexChainId(network.chainId),
                chainName: network.name,
                nativeCurrency: {
                  name: "Avalanche",
                  symbol: network.currencySymbol,
                  decimals: 18,
                },
                rpcUrls: [network.rpcUrl],
                blockExplorerUrls: [network.explorerUrl],
              },
            ],
          });
          setChainId(network.chainId);
        } catch (addErr) {
          setError(
            errorCode(addErr) === USER_REJECTED
              ? `Adding ${network.shortName} was rejected in the wallet.`
              : errorMessage(addErr),
          );
        }
      } else {
        setError(
          errorCode(err) === USER_REJECTED
            ? "Network switch was rejected in the wallet."
            : errorMessage(err),
        );
      }
    } finally {
      setStatus((s) => (s === "switching" ? "connected" : s));
    }
  }, []);

  const value = React.useMemo<WalletContextValue>(() => {
    const connected = status === "connected" || status === "switching";
    return {
      status,
      address,
      chainId,
      walletName,
      available,
      usingLegacyProvider: announced.length === 0 && legacy.length > 0,
      error,
      unsupportedChain:
        connected && chainId !== null && !networkByChainId(chainId),
      connect,
      disconnect,
      switchNetwork,
      rescan,
      getWalletClient,
      clearError: () => setError(null),
    };
  }, [
    status,
    address,
    chainId,
    walletName,
    available,
    announced.length,
    legacy.length,
    error,
    connect,
    disconnect,
    switchNetwork,
    rescan,
    getWalletClient,
  ]);

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

/**
 * The network whose data the app should display. Follows the connected wallet
 * when it is on a supported chain, otherwise falls back to the Fuji default.
 */
export function useActiveNetwork(): NetworkKey {
  const { chainId } = useWallet();
  if (chainId === null) return DEFAULT_NETWORK;
  return networkByChainId(chainId)?.key ?? DEFAULT_NETWORK;
}
