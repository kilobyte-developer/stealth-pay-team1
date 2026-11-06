import { ArrowRight, Check, KeyRound, Wallet, X } from "lucide-react";
import { Section, SectionHeading } from "@/components/landing/section";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";

function Node({
  label,
  sub,
  tone = "white",
}: {
  label: string;
  sub?: string;
  tone?: "white" | "coral" | "lime" | "blue" | "dashed";
}) {
  const tones = {
    white: "bg-white border-ink border-2",
    coral: "bg-coral border-ink border-2",
    lime: "bg-lime border-ink border-2",
    blue: "bg-blue text-white border-ink border-2",
    dashed: "bg-transparent border-ink border-2 border-dashed",
  };
  return (
    <div className={`${tones[tone]} px-3 py-2.5 text-center`}>
      <p className="font-display text-xs leading-tight font-bold">{label}</p>
      {sub ? <p className="mt-1 font-mono text-[0.6rem]">{sub}</p> : null}
    </div>
  );
}

export function Solution() {
  return (
    <Section id="solution">
      <SectionHeading
        eyebrow="Our solution"
        title={
          <>
            ONE IDENTITY.
            <br />
            UNLIMITED STEALTH ADDRESSES.
          </>
        }
        lead="Share a reusable Stealth Meta-Address once. Every sender derives a brand-new, one-time destination from it — and only you can find or spend what arrives there."
      />

      <div className="border-ink shadow-brutal-md mt-12 border-[3px] bg-white">
        {/* Traditional */}
        <div className="border-ink border-b-[3px] p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="border-ink bg-coral grid size-9 place-items-center border-2">
              <X className="size-5" aria-hidden="true" />
            </span>
            <SectionLabel>Traditional payment</SectionLabel>
            <Badge tone="coral" size="sm">
              Identity exposed
            </Badge>
          </div>

          <div className="mt-5 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Node label="Sender" sub="0xE41b…C72a" />
            <ArrowRight
              className="mx-auto size-6 rotate-90 sm:rotate-0"
              aria-hidden="true"
            />
            <Node label="Alice's primary wallet" sub="0x6B2e…7E42" tone="coral" />
          </div>

          <p className="text-grey mt-4 text-sm leading-relaxed">
            The receiving address is reusable and publicly tied to Alice.
            Every future payment to it is linkable to the same person.
          </p>
        </div>

        {/* StealthPay */}
        <div className="bg-paper-2 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="border-ink bg-lime grid size-9 place-items-center border-2">
              <Check className="size-5" aria-hidden="true" />
            </span>
            <SectionLabel>StealthPay</SectionLabel>
            <Badge tone="lime" size="sm">
              Identity unlinkable
            </Badge>
          </div>

          <div className="mt-5 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <Node label="Sender" sub="0xE41b…C72a" />
            <ArrowRight
              className="mx-auto size-6 rotate-90 sm:rotate-0"
              aria-hidden="true"
            />
            <Node
              label="One-time stealth address"
              sub="0x7Ae4…41Be"
              tone="blue"
            />
            <ArrowRight
              className="mx-auto size-6 rotate-90 sm:rotate-0"
              aria-hidden="true"
            />
            <Node
              label="Alice detects it privately"
              sub="private viewing key"
              tone="dashed"
            />
          </div>

          <p className="text-grey mt-4 text-sm leading-relaxed">
            The address funds land on is used once and is derived from public
            key material. Alice&apos;s reusable wallet never appears in the
            transaction.
          </p>
        </div>
      </div>

      {/* Supporting points */}
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {[
          {
            icon: Wallet,
            title: "No sender friction",
            body: "Senders don't need a new wallet, token, or mental model. They pay an address.",
          },
          {
            icon: KeyRound,
            title: "Keys stay yours",
            body: "Viewing and spending keys are generated and used client-side. Never uploaded.",
          },
          {
            icon: Check,
            title: "Standards-based",
            body: "Built on ERC-5564 rather than a bespoke scheme, so it interoperates.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="border-ink shadow-brutal-sm border-2 bg-white p-5"
          >
            <span className="border-ink bg-lime grid size-10 place-items-center border-2">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <p className="font-display mt-4 text-base font-bold">{title}</p>
            <p className="text-grey mt-1.5 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
