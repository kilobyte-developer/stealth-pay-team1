"use client";

import * as React from "react";
import {
  DEFAULT_CHAIN_ID,
  SCHEME_ID_SECP256K1,
  checkStealthAnnouncement,
  deriveOneTimeSpendingKey,
  generateStealthIdentity,
  toSafeErrorMessage,
  type StealthCheckResult,
  type StealthIdentityBundle,
  type StealthIdentityPublic,
  type SupportedChainId,
} from "@/lib/stealth";
import { NETWORKS } from "@/config/networks";
import { useActiveNetwork } from "@/providers/wallet-provider";
import type { Address, Hex } from "viem";

export interface AnnouncementInput {
  stealthAddress: Address;
  ephemeralPublicKey: Hex;
  viewTag: Hex;
  schemeId?: number;
}

export interface SpendKeyProof {
  ok: boolean;
  /** Address the recovered key controls. Present only on success. */
  stealthAddress?: Address;
  error?: string;
}

interface StealthIdentityContextValue {
  /** Public half only. Secrets are never placed in React state. */
  publicIdentity: StealthIdentityPublic | null;
  hasIdentity: boolean;
  /** True when the identity's chain differs from the wallet's active chain. */
  chainMismatch: boolean;
  activeChainName: string;
  error: string | null;

  createIdentity: (chainId?: SupportedChainId) => void;
  /** Best-effort destruction of in-memory secrets. */
  lockIdentity: () => void;
  clearError: () => void;

  /** Runs a real ERC-5564 check using the in-memory viewing key. */
  checkAnnouncement: (input: AnnouncementInput) => StealthCheckResult | null;
  /**
   * Derives the one-time spending key, verifies it controls the announced
   * address, then destroys it. Returns proof of control — never the key.
   */
  proveSpendControl: (input: AnnouncementInput) => SpendKeyProof;
}

const StealthIdentityContext =
  React.createContext<StealthIdentityContextValue | null>(null);

export function useStealthIdentity() {
  const ctx = React.useContext(StealthIdentityContext);
  if (!ctx) {
    throw new Error(
      "useStealthIdentity must be used inside <StealthIdentityProvider>",
    );
  }
  return ctx;
}

/**
 * Holds a stealth identity for the current browser session.
 *
 * ## Security boundary
 * The full {@link StealthIdentityBundle} — including both private scalars —
 * lives only in a ref inside this provider's closure. It is never put into
 * React state, never passed as a prop, and never returned from the context.
 * Components that need a cryptographic operation call a method here instead.
 *
 * ## Persistence
 * There is deliberately none. Nothing is written to `localStorage`,
 * `sessionStorage`, cookies, IndexedDB, an API route or Supabase. A page
 * refresh, tab close or `lockIdentity()` destroys the identity permanently —
 * there is no backup or recovery mechanism in this milestone, and any future
 * one must be designed separately.
 */
export function StealthIdentityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const bundleRef = React.useRef<StealthIdentityBundle | null>(null);
  const [publicIdentity, setPublicIdentity] =
    React.useState<StealthIdentityPublic | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const activeNetworkKey = useActiveNetwork();
  const activeChainId = NETWORKS[activeNetworkKey].chainId as SupportedChainId;

  const createIdentity = React.useCallback(
    (chainId?: SupportedChainId) => {
      setError(null);
      try {
        bundleRef.current?.secrets.destroy();
        const bundle = generateStealthIdentity(
          chainId ?? activeChainId ?? DEFAULT_CHAIN_ID,
        );
        bundleRef.current = bundle;
        setPublicIdentity(bundle.publicIdentity);
      } catch (err) {
        setError(toSafeErrorMessage(err));
      }
    },
    [activeChainId],
  );

  const lockIdentity = React.useCallback(() => {
    bundleRef.current?.secrets.destroy();
    bundleRef.current = null;
    setPublicIdentity(null);
    setError(null);
  }, []);

  // Destroy secrets if the provider itself is torn down.
  React.useEffect(() => {
    return () => {
      bundleRef.current?.secrets.destroy();
      bundleRef.current = null;
    };
  }, []);

  const checkAnnouncement = React.useCallback(
    (input: AnnouncementInput): StealthCheckResult | null => {
      const bundle = bundleRef.current;
      if (!bundle) return null;
      setError(null);
      try {
        return checkStealthAnnouncement({
          stealthAddress: input.stealthAddress,
          ephemeralPublicKey: input.ephemeralPublicKey,
          viewTag: input.viewTag,
          viewingPrivateKey: bundle.secrets.viewingPrivateKey,
          spendingPublicKey: bundle.publicIdentity.spendingPublicKey,
          schemeId: input.schemeId ?? SCHEME_ID_SECP256K1,
        });
      } catch (err) {
        setError(toSafeErrorMessage(err));
        return null;
      }
    },
    [],
  );

  const proveSpendControl = React.useCallback(
    (input: AnnouncementInput): SpendKeyProof => {
      const bundle = bundleRef.current;
      if (!bundle) return { ok: false, error: "No identity in this session." };

      try {
        const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
          ephemeralPublicKey: input.ephemeralPublicKey,
          viewingPrivateKey: bundle.secrets.viewingPrivateKey,
          spendingPrivateKey: bundle.secrets.spendingPrivateKey,
          expectedStealthAddress: input.stealthAddress,
          schemeId: input.schemeId ?? SCHEME_ID_SECP256K1,
        });
        // The key is proven and immediately discarded. Signing a real
        // transaction with it is a later milestone.
        privateKey.destroy();
        return { ok: true, stealthAddress };
      } catch (err) {
        return { ok: false, error: toSafeErrorMessage(err) };
      }
    },
    [],
  );

  const value = React.useMemo<StealthIdentityContextValue>(
    () => ({
      publicIdentity,
      hasIdentity: publicIdentity !== null,
      chainMismatch:
        publicIdentity !== null && publicIdentity.chainId !== activeChainId,
      activeChainName: NETWORKS[activeNetworkKey].shortName,
      error,
      createIdentity,
      lockIdentity,
      clearError: () => setError(null),
      checkAnnouncement,
      proveSpendControl,
    }),
    [
      publicIdentity,
      activeChainId,
      activeNetworkKey,
      error,
      createIdentity,
      lockIdentity,
      checkAnnouncement,
      proveSpendControl,
    ],
  );

  return (
    <StealthIdentityContext.Provider value={value}>
      {children}
    </StealthIdentityContext.Provider>
  );
}
