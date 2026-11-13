"use client";

import * as React from "react";
import { parseUnits, type Address, type Hex } from "viem";
import { getLocalActivity, recordLocalActivity } from "@/lib/activity/local-log";
import { useActiveNetwork, useWallet } from "@/providers/wallet-provider";
import type { OneTimeStealthAddress } from "@/lib/stealth";
import { FUJI_USDC, X402_FUJI_NETWORK } from "@/lib/x402/config";
import {
  X402ClientError,
  getX402Payment,
  payStealthAddressViaX402,
  retryX402Announcement,
  type X402PaymentView,
} from "@/lib/x402/client";

export type X402BlockedReason =
  | "wallet-not-connected"
  | "unsupported-chain"
  | "x402-fuji-only"
  | "wallet-rpc-checking"
  | "wallet-rpc-mismatch";

export type X402SendStage =
  | "idle"
  | "requesting"
  | "signing"
  | "settling"
  | "confirmed"
  | "failed";

export interface X402PaymentState {
  blocked: X402BlockedReason | null;
  stage: X402SendStage;
  /** Settlement transaction (the token transfer), once confirmed on-chain. */
  txHash: Hex | null;
  payment: X402PaymentView | null;
  error: string | null;
  send: (input: { derived: OneTimeStealthAddress; amount: string }) => Promise<void>;
  retryAnnouncement: () => Promise<void>;
  reset: () => void;
}

/**
 * Pays a one-time stealth address with USDC through x402 (EIP-3009).
 *
 * The sender signs ONE typed-data authorization in MetaMask; no transaction
 * and no gas is needed from them. The backend + facilitator settle it, and
 * the backend publishes the ERC-5564 announcement only after the transfer is
 * confirmed on-chain. `confirmed` therefore means settled; `payment.status`
 * says whether the announcement is also confirmed.
 */
export function useX402Payment(): X402PaymentState {
  const network = useActiveNetwork();
  const { address, getWalletClient, unsupportedChain, walletRpcStatus } = useWallet();

  const [stage, setStage] = React.useState<X402SendStage>("idle");
  const [payment, setPayment] = React.useState<X402PaymentView | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const blocked: X402BlockedReason | null = !address
    ? "wallet-not-connected"
    : unsupportedChain
      ? "unsupported-chain"
      : network !== "fuji"
        ? "x402-fuji-only"
        : walletRpcStatus === "checking"
          ? "wallet-rpc-checking"
          : walletRpcStatus === "mismatch"
            ? "wallet-rpc-mismatch"
            : null;

  const reset = React.useCallback(() => {
    setStage("idle");
    setPayment(null);
    setError(null);
  }, []);

  /** Guards against a double click starting two payment flows. */
  const inFlight = React.useRef(false);

  /** Records a payment in Activity — only ever once settlement is verified. */
  const recordSend = React.useCallback(
    (view: X402PaymentView, from: Address, amount: string) => {
      if (!view.settlementTx || (view.status !== "settled" && view.status !== "announced")) return;
      recordLocalActivity({
        id: view.settlementTx,
        kind: "send",
        network,
        from,
        to: view.stealthAddress,
        assetSymbol: FUJI_USDC.symbol,
        assetDecimals: FUJI_USDC.decimals,
        isNative: false,
        tokenContract: FUJI_USDC.address,
        amount,
        txHash: view.settlementTx,
        blockNumber: view.settlementBlock ?? "",
        timestamp: new Date().toISOString(),
        x402: { status: view.status, paymentId: view.id, announcementTx: view.announcementTx },
      });
    },
    [network],
  );

  /**
   * After an unknown outcome (facilitator timeout / lost response) the
   * backend keeps the payment `authorized` and reconciles it against the
   * chain. Poll that instead of asking the user to sign again.
   */
  const followUnknownOutcome = React.useCallback(
    async (id: Address, from: Address, amount: string) => {
      setStage("settling");
      setError("Settlement outcome not confirmed yet — checking the chain. Do not sign again.");
      const deadline = Date.now() + 7 * 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5_000));
        let view: X402PaymentView;
        try {
          view = await getX402Payment(id);
        } catch {
          continue;
        }
        setPayment(view);
        if (view.status === "settled" || view.status === "announced") {
          setStage("confirmed");
          setError(view.lastError);
          recordSend(view, from, amount);
          return;
        }
        if (view.status === "failed") {
          setStage("failed");
          setError(`${view.lastError ?? "Settlement failed."} Nothing was charged; you can try again.`);
          return;
        }
      }
      setStage("failed");
      setError("Still unconfirmed. Check this payment's status later before trying again.");
    },
    [recordSend],
  );

  const send = React.useCallback<X402PaymentState["send"]>(
    async ({ derived, amount }) => {
      if (blocked !== null || inFlight.current) return;
      const walletClient = getWalletClient();
      if (!walletClient || !walletClient.account) {
        setError("Wallet is unavailable. Reconnect and try again.");
        setStage("failed");
        return;
      }
      const account = walletClient.account;
      inFlight.current = true;
      setError(null);
      setPayment(null);

      try {
        const result = await payStealthAddressViaX402({
          derived,
          amount: parseUnits(amount, FUJI_USDC.decimals),
          asset: FUJI_USDC,
          network: X402_FUJI_NETWORK,
          signer: {
            address: account.address,
            signTypedData: (args) =>
              walletClient.signTypedData({
                ...(args as Omit<Parameters<typeof walletClient.signTypedData>[0], "account">),
                account,
              } as Parameters<typeof walletClient.signTypedData>[0]),
          },
          onStage: setStage,
        });

        setPayment(result.payment);
        setStage("confirmed");
        // Settled but announcement not confirmed: the payment succeeded;
        // surface the reason next to the retry button.
        setError(result.payment.lastError);
        recordSend(result.payment, account.address, amount);
      } catch (err) {
        if (err instanceof X402ClientError && err.payment) setPayment(err.payment);
        if (
          err instanceof X402ClientError &&
          (err.code === "settlement_outcome_unknown" || err.code === "payment_in_progress")
        ) {
          await followUnknownOutcome(derived.stealthAddress, account.address, amount);
          return;
        }
        setStage("failed");
        setError(describeX402Failure(err));
      } finally {
        inFlight.current = false;
      }
    },
    [blocked, getWalletClient, recordSend, followUnknownOutcome],
  );

  const retryAnnouncement = React.useCallback(async () => {
    if (!payment) return;
    try {
      const view = await retryX402Announcement(payment.id);
      setPayment(view);
      setError(view.lastError);
      // Keep Activity in step with the verified announcement state.
      const prior = getLocalActivity(network).find((e) => e.id === view.settlementTx);
      if (prior && view.settlementTx && (view.status === "settled" || view.status === "announced")) {
        recordLocalActivity({
          ...prior,
          x402: { status: view.status, paymentId: view.id, announcementTx: view.announcementTx },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Announcement retry failed.");
    }
  }, [payment, network]);

  return {
    blocked,
    stage,
    txHash: payment?.settlementTx ?? null,
    payment,
    error,
    send,
    retryAnnouncement,
    reset,
  };
}

/** Maps an x402 failure to a message a user can act on. */
export function describeX402Failure(err: unknown): string {
  const message = err instanceof Error ? err.message : "The payment failed.";
  if (/user rejected|denied|rejected the request/i.test(message)) {
    return "You rejected the signature in your wallet. Nothing was paid.";
  }
  if (!(err instanceof X402ClientError)) {
    return /fetch|network/i.test(message)
      ? "Could not reach the StealthPay server. Is `next dev` running?"
      : message;
  }
  switch (err.code) {
    case "insufficient_funds":
    case "invalid_exact_evm_insufficient_balance":
      return "Your wallet does not hold enough USDC for this payment. Nothing was charged.";
    case "x402_not_configured":
    case "x402_not_ready":
      return `The payment server is not ready: ${err.message}`;
    case "facilitator_unavailable":
      return "The x402 facilitator is unreachable. Nothing was authorized or charged; try again shortly.";
    case "already_paid":
      return "This one-time address has already been paid. Derive a fresh address for a new payment.";
    case "requirement_mismatch":
      return err.message;
    default:
      return `${err.message}${err.payment?.status === "failed" ? " Nothing was charged." : ""}`;
  }
}

export function describeX402Block(reason: X402BlockedReason): string {
  switch (reason) {
    case "wallet-not-connected":
      return "Connect a wallet to send a payment.";
    case "unsupported-chain":
      return "Switch your wallet to Fuji Testnet to send.";
    case "x402-fuji-only":
      return "x402 USDC payments are available on Fuji Testnet only.";
    case "wallet-rpc-checking":
      return WALLET_RPC_CHECKING_MESSAGE;
    case "wallet-rpc-mismatch":
      return WALLET_RPC_MISMATCH_MESSAGE;
  }
}

export const WALLET_RPC_CHECKING_MESSAGE =
  "Checking that your wallet is connected to the local Hardhat node…";
export const WALLET_RPC_MISMATCH_MESSAGE =
  "Your wallet reports chain 43113 but is NOT on this app's local Hardhat node (it is probably on public Avalanche Fuji). In MetaMask, select the network whose RPC is http://127.0.0.1:8545, then reload.";
