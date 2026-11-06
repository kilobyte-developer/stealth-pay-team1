import Link from "next/link";
import { ArrowDownToLine, Clock, Shuffle, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DemoTag } from "@/components/ui/demo-tag";
import { SectionLabel } from "@/components/ui/section-label";
import { estimateUsd, formatAmount } from "@/lib/format";
import { MOCK_SUMMARY } from "@/data/mock/transactions";

export function BalanceCard() {
  const stats = [
    {
      icon: Shuffle,
      label: "Stealth addresses",
      value: String(MOCK_SUMMARY.stealthAddressCount),
      hint: "holding a detected balance",
    },
    {
      icon: Clock,
      label: "Pending",
      value: String(MOCK_SUMMARY.pendingCount),
      hint: "awaiting confirmation",
    },
    {
      icon: ArrowDownToLine,
      label: "Received this month",
      value: `${formatAmount(MOCK_SUMMARY.receivedThisMonth)} AVAX`,
      hint: "across all one-time addresses",
    },
  ];

  return (
    <div className="border-ink shadow-brutal-lg border-[3px] bg-white">
      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        {/* Headline balance */}
        <div className="border-ink bg-lime border-b-[3px] p-6 sm:p-8 lg:border-r-[3px] lg:border-b-0">
          <div className="flex flex-wrap items-center gap-2">
            <SectionLabel>Total detected balance</SectionLabel>
            <DemoTag />
          </div>

          <p className="font-display mt-5 text-[clamp(2.5rem,8vw,4.5rem)] leading-none font-bold">
            {formatAmount(MOCK_SUMMARY.totalAvax)}
            <span className="ml-2 text-2xl sm:text-3xl">AVAX</span>
          </p>

          <p className="text-ink/70 mt-3 text-sm">
            ≈ {estimateUsd(MOCK_SUMMARY.totalAvax)} estimated value
            <span className="block text-xs">
              Fixed placeholder rate — not a live price feed.
            </span>
          </p>

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
              <Wallet className="size-4" aria-hidden="true" />
              Send
            </Link>
          </div>
        </div>

        {/* Supporting stats */}
        <dl className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className={`border-ink/15 p-5 ${
                  i < stats.length - 1
                    ? "border-b-2 sm:border-r-2 sm:border-b-0 lg:border-r-0 lg:border-b-2"
                    : ""
                }`}
              >
                <dt className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                    {s.label}
                  </span>
                </dt>
                <dd className="font-display mt-2 text-2xl font-bold">
                  {s.value}
                </dd>
                <p className="text-grey mt-0.5 text-xs">{s.hint}</p>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
