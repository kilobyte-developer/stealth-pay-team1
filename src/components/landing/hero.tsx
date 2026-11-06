import Link from "next/link";
import { ArrowRight, BookOpen, Snowflake } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeroDiagram } from "@/components/landing/hero-diagram";

const MARQUEE_ITEMS = [
  "ERC-5564 stealth addresses",
  "Avalanche C-Chain",
  "One-time receiving addresses",
  "Private payment detection",
  "Self-custodial",
  "Fuji testnet demo",
];

export function Hero() {
  return (
    <section className="border-ink dot-grid border-b-[3px]">
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="animate-rise-in flex flex-wrap items-center gap-2">
          <Badge tone="white" size="md">
            <Snowflake className="size-3" aria-hidden="true" />
            Built on Avalanche
          </Badge>
          <Badge tone="lime" size="md">
            Fuji Testnet
          </Badge>
        </div>

        <h1
          className="animate-rise-in mt-7 text-[clamp(2.75rem,10vw,7.5rem)]"
          style={{ animationDelay: "60ms" }}
        >
          YOUR WALLET.
          <br />
          YOUR PRIVACY.
          <br />
          <span className="text-blue">YOUR CONTROL.</span>
        </h1>

        <div
          className="animate-rise-in mt-8 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start"
          style={{ animationDelay: "120ms" }}
        >
          <div>
            <p className="max-w-xl text-lg leading-relaxed sm:text-xl">
              Receive cryptocurrency through unique stealth addresses. Keep your
              reusable wallet identity out of the public payment trail.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "primary", size: "xl" })}
              >
                Launch App
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
              <Link
                href="#how-it-works"
                className={buttonVariants({ variant: "secondary", size: "xl" })}
              >
                <BookOpen className="size-4" aria-hidden="true" />
                Explore How It Works
              </Link>
            </div>

            <dl className="border-ink mt-10 grid grid-cols-3 border-2 bg-white">
              {[
                { k: "Addresses per receiver", v: "Unlimited" },
                { k: "Keys shared with sender", v: "Public only" },
                { k: "Fund custody", v: "Self-held" },
              ].map((s, i) => (
                <div
                  key={s.k}
                  className={
                    i < 2 ? "border-ink border-r-2 p-3 sm:p-4" : "p-3 sm:p-4"
                  }
                >
                  <dt className="font-display text-grey text-[0.6rem] font-bold tracking-[0.14em] uppercase">
                    {s.k}
                  </dt>
                  <dd className="font-display mt-1.5 text-sm font-bold sm:text-base">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroDiagram />
        </div>
      </div>

      {/* Marquee band */}
      <div
        className="border-ink bg-ink text-paper overflow-hidden border-t-[3px] py-3"
        aria-hidden="true"
      >
        <div className="animate-marquee flex w-max gap-8 pr-8">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="font-display flex shrink-0 items-center gap-8 text-xs font-bold tracking-[0.2em] whitespace-nowrap uppercase"
            >
              {item}
              <span className="bg-lime size-2" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
