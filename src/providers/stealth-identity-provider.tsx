"use client";

import * as React from "react";
import {
  DEFAULT_CHAIN_ID,
  SCHEME_ID_SECP256K1,
  checkStealthAnnouncement,
  deriveOneTimeSpendingKey,
  generateStealthIdentity,
  toSafeErrorMessage,
  type OneTimeSpendingKey,
  type StealthCheckResult,
  type StealthIdentityBundle,
  type StealthIdentityPublic,
  type SupportedChainId,
} from "@/lib/stealth";
import { createWalletClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain, getPublicClient } from "@/lib/chain/client";
import { recordLocalActivity } from "@/lib/activity/local-log";
import { logTransactionForDebug } from "@/lib/supabase/log-transaction-for-debug";
import {
  DEFAULT_AUTO_LOCK_MS,
  changeVaultPassword,
  confirmBackupStored,
  createVault,
  exportBackup,
  getVaultStatus,
  hasVault,
  importBackup,
  toSafeVaultMessage,
  unlockVault,
  type VaultStatus,
} from "@/lib/vault";
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
  stealthAddress?: Address;
  error?: string;
}

export interface ForwardPaymentResult {
  ok: boolean;
  txHash?: Hex;
  error?: string;
}

export interface BackupFile {
  filename: string;
  contents: string;
}

interface StealthIdentityContextValue {
  /** Public half only. Secrets are never placed in React state. */
  publicIdentity: StealthIdentityPublic | null;
  hasIdentity: boolean;
  /** True when an encrypted vault exists on this device. */
  vaultExists: boolean;
  /** True while the vault exists but is not unlocked in memory. */
  isLocked: boolean;
  vaultStatus: VaultStatus | null;
  busy: boolean;
  /** True when the identity's chain differs from the wallet's active chain. */
  chainMismatch: boolean;
  activeChainName: string;
  error: string | null;

  /** Generates a new identity AND encrypts it into the local vault. */
  createIdentity: (
    password: string,
    chainId?: SupportedChainId,
    options?: { allowOverwrite?: boolean },
  ) => Promise<boolean>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  requestExport: (password: string) => Promise<BackupFile | null>;
  requestImport: (
    fileContents: string,
    password: string,
    options?: { allowOverwrite?: boolean },
  ) => Promise<boolean>;
  changePassword: (current: string, next: string) => Promise<boolean>;
  confirmBackup: () => Promise<void>;
  refreshVaultStatus: () => Promise<void>;
  clearError: () => void;

  checkAnnouncement: (input: AnnouncementInput) => StealthCheckResult | null;
  proveSpendControl: (input: AnnouncementInput) => SpendKeyProof;
  /**
   * Sweeps the full native balance of a detected one-time stealth address to
   * `to`. Signs locally with the derived one-time key — never via the
   * connected wallet, since that wallet does not and cannot hold this key.
   */
  forwardPayment: (
    input: AnnouncementInput & { to: Address },
  ) => Promise<ForwardPaymentResult>;
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
 * Owns the stealth identity for this browser session.
 *
 * ## Security boundary
 * The full {@link StealthIdentityBundle} — both private scalars — lives only
 * in a ref inside this closure. It is never placed in React state, never
 * passed as a prop, and never returned from the context. There is deliberately
 * no getter that returns raw private keys. Components call narrow operations
 * and receive results.
 *
 * Vault passwords are passed in as short-lived arguments, used once, and never
 * stored, logged or sent anywhere.
 *
 * ## Persistence
 * Only the Argon2id + AES-256-GCM ciphertext is persisted, in IndexedDB. A
 * refresh no longer destroys the identity — it locks it. Recovery across
 * devices requires the exported backup file plus its password; there is no
 * server-side copy and no reset path.
 */
export function StealthIdentityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const bundleRef = React.useRef<StealthIdentityBundle | null>(null);
  const [publicIdentity, setPublicIdentity] =
    React.useState<StealthIdentityPublic | null>(null);
  const [vaultStatus, setVaultStatus] = React.useState<VaultStatus | null>(null);
  const [vaultExists, setVaultExists] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const activeNetworkKey = useActiveNetwork();
  const activeChainId = NETWORKS[activeNetworkKey].chainId as SupportedChainId;

  const unlocked = publicIdentity !== null;

  const refreshVaultStatus = React.useCallback(async () => {
    try {
      const [exists, status] = await Promise.all([
        hasVault(),
        getVaultStatus(bundleRef.current !== null),
      ]);
      setVaultExists(exists);
      setVaultStatus(status);
    } catch {
      // Storage unavailable (private mode, blocked site data). The app still
      // works; it simply cannot persist an identity.
      setVaultExists(false);
      setVaultStatus(null);
    }
  }, []);

  // Detect an existing vault on first mount so the unlock screen can appear.
  React.useEffect(() => {
    void refreshVaultStatus();
  }, [refreshVaultStatus]);

  const lock = React.useCallback(() => {
    bundleRef.current?.secrets.destroy();
    bundleRef.current = null;
    setPublicIdentity(null);
    setError(null);
    void refreshVaultStatus();
  }, [refreshVaultStatus]);

  // Destroy secrets if the provider is torn down.
  React.useEffect(() => {
    return () => {
      bundleRef.current?.secrets.destroy();
      bundleRef.current = null;
    };
  }, []);

  /* ---- Inactivity auto-lock ---- */
  // Seeded inside the effect, not during render: reading the clock while
  // rendering is impure and can yield unstable values across re-renders.
  const lastActivity = React.useRef(0);
  React.useEffect(() => {
    if (!unlocked) return;
    lastActivity.current = Date.now();

    const bump = () => {
      lastActivity.current = Date.now();
    };
    const windowEvents: (keyof WindowEventMap)[] = ["pointerdown", "keydown"];
    for (const e of windowEvents) window.addEventListener(e, bump);
    // `visibilitychange` is a document event, not a window event.
    document.addEventListener("visibilitychange", bump);

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= DEFAULT_AUTO_LOCK_MS) lock();
    }, 30_000);

    return () => {
      for (const e of windowEvents) window.removeEventListener(e, bump);
      document.removeEventListener("visibilitychange", bump);
      window.clearInterval(timer);
    };
  }, [unlocked, lock]);

  /* ---- Operations ---- */

  async function run<T>(
    operation: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (err) {
      setError(toSafeVaultMessage(err) || toSafeErrorMessage(err));
      return fallback;
    } finally {
      setBusy(false);
      void refreshVaultStatus();
    }
  }

  const createIdentity = React.useCallback(
    async (
      password: string,
      chainId?: SupportedChainId,
      options?: { allowOverwrite?: boolean },
    ) =>
      run(async () => {
        const bundle = generateStealthIdentity(
          chainId ?? activeChainId ?? DEFAULT_CHAIN_ID,
        );
        try {
          // Encrypts, verifies the round trip, then persists. Throws before
          // writing anything if the round trip fails.
          await createVault(bundle, password, options);
        } catch (err) {
          bundle.secrets.destroy();
          throw err;
        }
        bundleRef.current?.secrets.destroy();
        bundleRef.current = bundle;
        setPublicIdentity(bundle.publicIdentity);
        return true;
      }, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeChainId, refreshVaultStatus],
  );

  const unlock = React.useCallback(
    async (password: string) =>
      run(async () => {
        const bundle = await unlockVault(password);
        bundleRef.current?.secrets.destroy();
        bundleRef.current = bundle;
        setPublicIdentity(bundle.publicIdentity);
        lastActivity.current = Date.now();
        return true;
      }, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshVaultStatus],
  );

  const requestExport = React.useCallback(
    async (password: string) =>
      run<BackupFile | null>(async () => exportBackup(password), null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshVaultStatus],
  );

  const requestImport = React.useCallback(
    async (
      fileContents: string,
      password: string,
      options?: { allowOverwrite?: boolean },
    ) =>
      run(async () => {
        const bundle = await importBackup(fileContents, password, options);
        bundleRef.current?.secrets.destroy();
        bundleRef.current = bundle;
        setPublicIdentity(bundle.publicIdentity);
        lastActivity.current = Date.now();
        return true;
      }, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshVaultStatus],
  );

  const changePassword = React.useCallback(
    async (current: string, next: string) =>
      run(async () => {
        await changeVaultPassword(current, next);
        return true;
      }, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshVaultStatus],
  );

  const confirmBackup = React.useCallback(async () => {
    await run(async () => {
      await confirmBackupStored();
      return true;
    }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshVaultStatus]);

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
      if (!bundle) return { ok: false, error: "No identity unlocked." };
      try {
        const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
          ephemeralPublicKey: input.ephemeralPublicKey,
          viewingPrivateKey: bundle.secrets.viewingPrivateKey,
          spendingPrivateKey: bundle.secrets.spendingPrivateKey,
          expectedStealthAddress: input.stealthAddress,
          schemeId: input.schemeId ?? SCHEME_ID_SECP256K1,
        });
        // Proven, then immediately discarded. Signing a real transaction with
        // it belongs to a later milestone.
        privateKey.destroy();
        return { ok: true, stealthAddress };
      } catch (err) {
        return { ok: false, error: toSafeErrorMessage(err) };
      }
    },
    [],
  );

  const forwardPayment = React.useCallback(
    async (
      input: AnnouncementInput & { to: Address },
    ): Promise<ForwardPaymentResult> => {
      const bundle = bundleRef.current;
      if (!bundle) return { ok: false, error: "No identity unlocked." };

      let derivedKey: OneTimeSpendingKey | null = null;
      try {
        derivedKey = deriveOneTimeSpendingKey({
          ephemeralPublicKey: input.ephemeralPublicKey,
          viewingPrivateKey: bundle.secrets.viewingPrivateKey,
          spendingPrivateKey: bundle.secrets.spendingPrivateKey,
          expectedStealthAddress: input.stealthAddress,
          schemeId: input.schemeId ?? SCHEME_ID_SECP256K1,
        });

        // Signs with the one-time key directly, over the public RPC — this
        // address was never imported into the connected wallet, and never
        // should be.
        const account = privateKeyToAccount(derivedKey.privateKey.toHex());
        const chain = getChain(activeNetworkKey);
        const publicClient = getPublicClient(activeNetworkKey);
        const walletClient = createWalletClient({
          account,
          chain,
          transport: http(NETWORKS[activeNetworkKey].rpcUrl),
        });

        const balance = await publicClient.getBalance({
          address: account.address,
        });
        const gasLimit = 21_000n;
        // A legacy (type-0) transaction with explicit gas fields is used
        // deliberately: it lets the exact fee be known up front, so the full
        // balance minus that fee can be swept without leaving dust or risking
        // an underfunded EIP-1559 fee estimate.
        const gasPrice = (await publicClient.getGasPrice() * 120n) / 100n;
        const fee = gasPrice * gasLimit;

        if (balance <= fee) {
          return {
            ok: false,
            error: "Balance is too low to cover the network fee to forward it.",
          };
        }

        const hash = await walletClient.sendTransaction({
          to: input.to,
          value: balance - fee,
          gas: gasLimit,
          gasPrice,
          chain,
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
        });
        if (receipt.status !== "success") {
          return {
            ok: false,
            error: "The forwarding transaction reverted on-chain.",
          };
        }

        recordLocalActivity({
          id: hash,
          kind: "forward",
          network: activeNetworkKey,
          from: account.address,
          to: input.to,
          assetSymbol: "AVAX",
          assetDecimals: 18,
          isNative: true,
          tokenContract: null,
          amount: formatEther(balance - fee),
          txHash: hash,
          blockNumber: receipt.blockNumber.toString(),
          timestamp: new Date().toISOString(),
        });
        // Dev-only debug log — see docs/DEBUG_LOG.md. Fire-and-forget, never
        // affects the forward above, which has already succeeded.
        logTransactionForDebug({
          txHash: hash,
          kind: "forward",
          network: activeNetworkKey,
          from: account.address,
          to: input.to,
          assetSymbol: "AVAX",
          isNative: true,
          tokenContract: null,
          amount: formatEther(balance - fee),
          blockNumber: receipt.blockNumber.toString(),
        });

        return { ok: true, txHash: hash };
      } catch (err) {
        return { ok: false, error: toSafeErrorMessage(err) };
      } finally {
        derivedKey?.privateKey.destroy();
      }
    },
    [activeNetworkKey],
  );

  const value = React.useMemo<StealthIdentityContextValue>(
    () => ({
      publicIdentity,
      hasIdentity: unlocked,
      vaultExists,
      isLocked: vaultExists && !unlocked,
      vaultStatus,
      busy,
      chainMismatch:
        publicIdentity !== null && publicIdentity.chainId !== activeChainId,
      activeChainName: NETWORKS[activeNetworkKey].shortName,
      error,
      createIdentity,
      unlock,
      lock,
      requestExport,
      requestImport,
      changePassword,
      confirmBackup,
      refreshVaultStatus,
      clearError: () => setError(null),
      checkAnnouncement,
      proveSpendControl,
      forwardPayment,
    }),
    [
      publicIdentity,
      unlocked,
      vaultExists,
      vaultStatus,
      busy,
      activeChainId,
      activeNetworkKey,
      error,
      createIdentity,
      unlock,
      lock,
      requestExport,
      requestImport,
      changePassword,
      confirmBackup,
      refreshVaultStatus,
      checkAnnouncement,
      proveSpendControl,
      forwardPayment,
    ],
  );

  return (
    <StealthIdentityContext.Provider value={value}>
      {children}
    </StealthIdentityContext.Provider>
  );
}
