"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  Fuel,
  LoaderCircle,
  RefreshCw,
  Shuffle,
  Wallet,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";
import { useStealthPayments } from "@/hooks/use-stealth-payments";
import { useNativeBalance } from "@/hooks/use-native-balance";
import { useWallet } from "@/providers/wallet-provider";
import { formatAvax, totalNativeWei } from "@/lib/payments/view-model";
import { truncateMiddle } from "@/lib/format";

/**
 * Headline balances, all read from the chain.
 *
 * The large figure is the total verified native balance across detected stealth
 * addresses — the funds actually under the user's control through StealthPay.
 * The connected wallet's own balance is shown separately, because it is a
 * different key system and deliberately not part of the stealth total.
 */
export function BalanceCard() {
  const { payments, status, reason, rescan } = useStealthPayments();
  const { address } = useWallet();
  const walletBalance = useNativeBalance(address);

  const stealthWei = totalNativeWei(payments);
  const nativeCount = payments.filter((p) => p.assetKind === "native").length;
  const tokenNeedingGas = payments.filter(
    (p) => p.assetKind === "erc20" && p.verifiedBalance > 0n,
  ).length;

  const scanning = status === "scanning";
  const unavailable = status === "unavailable";

  return (
    <div className="border-ink shadow-brutal-lg border-[3px] bg-white">
      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        {/* Stealth balance */}
        <div className="border-ink bg-lime border-b-[3px] p-6 sm:p-8 lg:border-r-[3px] lg:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Stealth balance</SectionLabel>
            {scanning ? (
              <Badge tone="white" size="sm">
                <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                Scanning
              </Badge>
            ) : null}
          </div>

          {unavailable ? (
            <>
              <p className="font-display mt-5 text-[clamp(2rem,6vw,3rem)] leading-none font-bold">
                —
              </p>
              <p className="text-ink/70 mt-3 text-sm leading-relaxed">
                {reason === "identity-locked"
                  ? "Unlock your identity to scan for payments."
                  : "Configure an Announcer address to scan for payments."}
              </p>
            </>
          ) : (
            <>
              <p className="font-display mt-5 text-[clamp(2.5rem,8vw,4.5rem)] leading-none font-bold">
                {formatAvax(stealthWei)}
                <span className="ml-2 text-2xl sm:text-3xl">AVAX</span>
              </p>
              <p className="text-ink/70 mt-3 text-sm">
                Across {nativeCount} stealth{" "}
                {nativeCount === 1 ? "address" : "addresses"}, verified on-chain
              </p>
            </>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            <Link
              href="/receive"
              className={buttonVariants({ variant: "dark", size: "md" })}
            >
              <ArrowDownToLine className="size-4" aria-hidden="true" />
              Receive
            </Link>
            <Link
              href="/send"
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              Send
            </Link>
            {!unavailable ? (
              <Button variant="secondary" size="md" onClick={rescan}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Rescan
              </Button>
            ) : null}
          </div>
        </div>

        {/* Supporting figures */}
        <dl className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1">
          <div className="border-ink/15 border-b-2 p-5 sm:border-r-2 sm:border-b-0 lg:border-r-0 lg:border-b-2">
            <dt className="flex items-center gap-2">
              <Shuffle className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                Stealth addresses
              </span>
            </dt>
            <dd className="font-display mt-2 text-2xl font-bold">
              {unavailable ? "—" : payments.length}
            </dd>
            <p className="text-grey mt-0.5 text-xs">holding a verified balance</p>
          </div>

          <div className="border-ink/15 border-b-2 p-5 sm:border-r-2 sm:border-b-0 lg:border-r-0 lg:border-b-2">
            <dt className="flex items-center gap-2">
              <Fuel className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                Needs gas
              </span>
            </dt>
            <dd className="font-display mt-2 text-2xl font-bold">
              {unavailable ? "—" : tokenNeedingGas}
            </dd>
            <p className="text-grey mt-0.5 text-xs">
              token balances without AVAX to spend
            </p>
          </div>

          <div className="p-5">
            <dt className="flex items-center gap-2">
              <Wallet className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                Connected wallet
              </span>
            </dt>
            <dd className="font-display mt-2 text-2xl font-bold">
              {address === null
                ? "—"
                : walletBalance.state === "ready" && walletBalance.value !== null
                  ? `${formatAvax(walletBalance.value)} AVAX`
                  : walletBalance.state === "error"
                    ? "Unavailable"
                    : "…"}
            </dd>
            <p className="text-grey mt-0.5 text-xs">
              {address
                ? `${truncateMiddle(address, 6, 4)} — separate from stealth funds`
                : "not connected"}
            </p>
          </div>
        </dl>
      </div>
    </div>
  );
}
