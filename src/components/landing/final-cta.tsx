import Link from "next/link";
import { ArrowRight, Fingerprint } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";

export function FinalCta() {
  return (
    <section className="border-ink bg-lime dot-grid border-b-[3px]">
      <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
        <span className="border-ink bg-ink text-lime mx-auto grid size-14 place-items-center border-2">
          <Fingerprint className="size-7" aria-hidden="true" />
        </span>

        <SectionLabel className="mt-6">Get started</SectionLabel>

        <h2 className="mt-4 text-[clamp(2.25rem,7vw,5rem)]">
          MAKE EVERY PAYMENT
          <br />
          ADDRESS A FRESH START.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
          Publish one stealth meta-address. Receive on a new address every time.
          Keep your wallet identity out of the public payment trail.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "dark", size: "xl" })}
          >
            Launch StealthPay
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href="/identity"
            className={buttonVariants({ variant: "secondary", size: "xl" })}
          >
            See the key model
          </Link>
        </div>

        <p className="text-ink/65 mt-7 text-xs leading-relaxed">
          Runs on Avalanche Fuji. Your keys are generated and encrypted in your
          own browser.
        </p>
      </div>
    </section>
  );
}
