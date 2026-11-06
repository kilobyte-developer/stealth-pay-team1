"use client";

import * as React from "react";
import { parseEther, parseUnits, type Address, type Hex } from "viem";
import { StealthPaymentRouterAbi } from "@/config/abi";
import { CONTRACTS, NETWORKS } from "@/config/networks";
import { getPublicClient } from "@/lib/chain/client";
import { useActiveNetwork, useWallet } from "@/providers/wallet-provider";
import type { OneTimeStealthAddress } from "@/lib/stealth";

export type SendBlockedReason =
  | "wallet-not-connected"
  | "unsupported-chain"
  | "router-not-configured";

export type SendStage = "idle" | "signing" | "pending" | "confirmed" | "failed";

export interface SendPaymentState {
  blocked: SendBlockedReason | null;
  stage: SendStage;
  txHash: Hex | null;
  error: string | null;
  send: (input: {
    derived: OneTimeStealthAddress;
    amount: string;
    /** Native AVAX when null; otherwise an ERC-20 contract. */
    token: Address | null;
    tokenDecimals?: number;
    /** Optional native top-up accompanying a token payment, in AVAX. */
    gasTopUpAvax?: string;
  }) => Promise<void>;
  reset: () => void;
}

/**
 * Sends a stealth payment through the deployed StealthPaymentRouter.
 *
 * The router performs the transfer and the ERC-5564 announcement atomically, so
 * a confirmed transaction means both happened. Nothing is simulated: if the
 * prerequisites are missing, `blocked` says which, and `send` is not callable.
 */
export function useSendPayment(): SendPaymentState {
  const network = useActiveNetwork();
  const { address, getWalletClient, unsupportedChain } = useWallet();
  const router = CONTRACTS[network].router;

  const [stage, setStage] = React.useState<SendStage>("idle");
  const [txHash, setTxHash] = React.useState<Hex | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const blocked: SendBlockedReason | null = !address
    ? "wallet-not-connected"
    : unsupportedChain
      ? "unsupported-chain"
      : !router
        ? "router-not-configured"
        : null;

  const reset = React.useCallback(() => {
    setStage("idle");
    setTxHash(null);
    setError(null);
  }, []);

  const send = React.useCallback<SendPaymentState["send"]>(
    async ({ derived, amount, token, tokenDecimals, gasTopUpAvax }) => {
      if (blocked !== null || !router) return;

      const walletClient = getWalletClient();
      if (!walletClient || !walletClient.account) {
        setError("Wallet is unavailable. Reconnect and try again.");
        setStage("failed");
        return;
      }

      setError(null);
      setStage("signing");

      try {
        const topUp = gasTopUpAvax ? parseEther(gasTopUpAvax) : 0n;

        const hash = token
          ? await walletClient.writeContract({
              address: router,
              abi: StealthPaymentRouterAbi,
              functionName: "payERC20",
              args: [
                token,
                derived.stealthAddress,
                parseUnits(amount, tokenDecimals ?? 18),
                derived.ephemeralPublicKey,
                derived.viewTag,
              ],
              value: topUp,
              account: walletClient.account,
              chain: walletClient.chain,
            })
          : await walletClient.writeContract({
              address: router,
              abi: StealthPaymentRouterAbi,
              functionName: "payNative",
              args: [
                derived.stealthAddress,
                derived.ephemeralPublicKey,
                derived.viewTag,
              ],
              value: parseEther(amount),
              account: walletClient.account,
              chain: walletClient.chain,
            });

        setTxHash(hash);
        setStage("pending");

        const receipt = await getPublicClient(network).waitForTransactionReceipt({
          hash,
        });

        // A reverted transaction still produces a receipt, so status matters.
        if (receipt.status === "success") {
          setStage("confirmed");
        } else {
          setStage("failed");
          setError(
            "The transaction reverted on-chain. No funds were transferred.",
          );
        }
      } catch (err) {
        setStage("failed");
        const message =
          err instanceof Error ? err.message : "The transaction failed.";
        // Rejections are a normal outcome, not an error worth shouting about.
        setError(
          /user rejected|denied/i.test(message)
            ? "You rejected the transaction in your wallet."
            : message,
        );
      }
    },
    [blocked, router, getWalletClient, network],
  );

  return { blocked, stage, txHash, error, send, reset };
}

export function describeSendBlock(
  reason: SendBlockedReason,
  network: ReturnType<typeof useActiveNetwork>,
): string {
  switch (reason) {
    case "wallet-not-connected":
      return "Connect a wallet to send a payment.";
    case "unsupported-chain":
      return `Switch your wallet to ${NETWORKS[network].shortName} to send.`;
    case "router-not-configured":
      return "No payment router is configured for this network yet.";
  }
}
