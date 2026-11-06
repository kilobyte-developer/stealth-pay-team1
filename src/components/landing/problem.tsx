import { ArrowRight, Eye, TrendingUp, Users, Wallet } from "lucide-react";
import { Section, SectionHeading } from "@/components/landing/section";
import { SectionLabel } from "@/components/ui/section-label";

const EXPOSURES = [
  {
    icon: Eye,
    title: "Every incoming payment",
    body: "Anyone can watch what lands in your address, from whom, and when.",
  },
  {
    icon: TrendingUp,
    title: "Your running balance",
    body: "Your holdings and full history are permanently public.",
  },
  {
    icon: Users,
    title: "Your payment relationships",
    body: "Repeated counterparties reveal who you work with and get paid by.",
  },
];

const INCOMING = [
  { from: "Client A", amount: "10 AVAX" },
  { from: "Client B", amount: "2.5 AVAX" },
  { from: "Marketplace", amount: "0.75 AVAX" },
  { from: "Client A again", amount: "4 AVAX" },
];

export function Problem() {
  return (
    <Section id="problem" tone="paper2">
      <SectionHeading
        eyebrow="The problem"
        title="EVERY PAYMENT LEAVES A TRAIL."
        lead="Blockchains are public ledgers. The moment you share one wallet address to get paid, you hand every observer a permanent window into your finances — even if you never reveal your name."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        {/* Address reuse visual */}
        <div className="border-ink shadow-brutal border-[3px] bg-white p-5">
          <SectionLabel className="text-coral-deep">
            Address reuse — the default today
          </SectionLabel>

          <div className="mt-5 flex items-center gap-4">
            <ul className="flex-1 space-y-2">
              {INCOMING.map((p) => (
                <li
                  key={p.from}
                  className="border-ink bg-paper-2 flex items-center justify-between gap-2 border-2 px-2.5 py-2"
                >
                  <span className="text-[0.7rem] font-medium">{p.from}</span>
                  <span className="font-display text-[0.65rem] font-bold">
                    {p.amount}
                  </span>
                </li>
              ))}
            </ul>

            <ArrowRight className="size-6 shrink-0" aria-hidden="true" />

            <div className="border-ink bg-coral shadow-brutal-sm w-28 shrink-0 border-[3px] p-3 text-center sm:w-32">
              <Wallet className="mx-auto size-6" aria-hidden="true" />
              <p className="font-display mt-2 text-xs leading-tight font-bold">
                One reused wallet
              </p>
              <p className="mt-1.5 font-mono text-[0.6rem] break-all">
                0x6B2e…7E42
              </p>
            </div>
          </div>

          <p className="border-ink bg-paper-2 mt-5 border-2 p-3 text-xs leading-relaxed">
            Four payments, one address. An observer now has your balance, your
            counterparties, your cadence — and can correlate all of it to a
            single identity.
          </p>
        </div>

        {/* What gets exposed */}
        <div className="space-y-4">
          {EXPOSURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="border-ink shadow-brutal-sm flex gap-4 border-2 bg-white p-4 sm:p-5"
            >
              <span className="border-ink bg-coral grid size-10 shrink-0 place-items-center border-2">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-base font-bold">{title}</p>
                <p className="text-grey mt-1 text-sm leading-relaxed">{body}</p>
              </div>
            </div>
          ))}

          <div className="border-ink bg-ink text-paper border-2 p-5">
            <p className="font-display text-base font-bold">
              Not revealing your identity is not the same as privacy.
            </p>
            <p className="text-paper/70 mt-2 text-sm leading-relaxed">
              Reusing a single address does the de-anonymising work for an
              observer. Over time, the pattern itself becomes the identifier.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
