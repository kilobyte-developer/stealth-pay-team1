import { Eye, EyeOff, KeyRound, Lock, Shuffle, TriangleAlert } from "lucide-react";
import { Section, SectionHeading } from "@/components/landing/section";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";

const KEYS = [
  {
    icon: Eye,
    name: "Viewing key",
    pair: "(a, A)",
    tone: "bg-blue text-white",
    purpose:
      "Detects incoming payments. The private half scans announcements; the public half is published in your meta-address.",
    note: "Scanning needs only this key — never your spending key.",
  },
  {
    icon: KeyRound,
    name: "Spending key",
    pair: "(b, B)",
    tone: "bg-lime",
    purpose:
      "Recovers control of one-time addresses. The private half derives the key for each detected payment.",
    note: "Used only at the moment you spend, always client-side.",
  },
  {
    icon: Shuffle,
    name: "Ephemeral key",
    pair: "(r, R)",
    tone: "bg-coral",
    purpose:
      "Generated fresh by the sender for every single payment. Only the public half R is published on-chain.",
    note: "Reusing r across payments would break unlinkability.",
  },
];

const VISIBLE = [
  "The sender's address",
  "The destination stealth address",
  "The transaction amount",
  "Transaction timing",
  "Any onward transfer you make",
];

const HIDDEN = [
  "The link between a stealth address and your reusable wallet",
  "Which announcements belong to you (without your viewing key)",
  "Your primary wallet as a named counterparty",
];

export function Security() {
  return (
    <Section id="security" tone="paper2">
      <SectionHeading
        eyebrow="Security & privacy"
        title="PUBLIC KEYS TRAVEL. PRIVATE KEYS DO NOT."
        lead="StealthPay separates the ability to see payments from the ability to spend them, and keeps every secret on your own device."
      />

      {/* Three key pairs */}
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {KEYS.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.name}
              className="border-ink shadow-brutal-sm border-2 bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`border-ink grid size-11 place-items-center border-2 ${k.tone}`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-base font-bold">{k.name}</p>
                  <p className="text-grey font-mono text-xs">{k.pair}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed">{k.purpose}</p>
              <p className="border-ink bg-paper-2 mt-3 border-2 p-2.5 text-xs leading-relaxed">
                {k.note}
              </p>
            </div>
          );
        })}
      </div>

      {/* Derivation + custody */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="border-ink shadow-brutal border-[3px] bg-white p-5 sm:p-6">
          <SectionLabel className="text-blue">
            One-time address derivation
          </SectionLabel>
          <dl className="mt-4 space-y-3">
            {[
              { k: "Sender computes", v: "S = r·A    then    P = B + H(S)·G" },
              { k: "Receiver recomputes", v: "S' = a·R    then    P' = B + H(S')·G" },
              { k: "Receiver spends with", v: "x = (b + H(S')) mod n" },
            ].map((row) => (
              <div key={row.k}>
                <dt className="font-display text-[0.7rem] font-bold tracking-[0.14em] uppercase">
                  {row.k}
                </dt>
                <dd className="border-ink bg-paper-2 mt-1.5 border-2 px-2.5 py-2 font-mono text-xs break-words sm:text-sm">
                  {row.v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-grey mt-4 text-xs leading-relaxed">
            Both sides reach the same secret by elliptic-curve Diffie–Hellman,
            without ever exchanging a private key.
          </p>
        </div>

        <div className="border-ink bg-ink text-paper border-[3px] p-5 sm:p-6">
          <SectionLabel className="text-lime">Custody rules</SectionLabel>
          <ul className="mt-4 space-y-3">
            {[
              "Private keys are generated with a cryptographically secure random source.",
              "Receiver keys are never shared with senders.",
              "No private key is submitted to a backend API or written to the database.",
              "Spending-key derivation happens in a protected client-side context.",
              "Detected payments are verified against real on-chain transfers.",
            ].map((r) => (
              <li key={r} className="flex gap-3">
                <Lock
                  className="text-lime mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="text-paper/80 text-sm leading-relaxed">
                  {r}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Honest scope */}
      <div className="border-ink shadow-brutal-md mt-6 border-[3px] bg-white">
        <div className="border-ink bg-coral flex flex-wrap items-center gap-3 border-b-[3px] p-4">
          <TriangleAlert className="size-5" aria-hidden="true" />
          <p className="font-display text-sm font-bold tracking-wide uppercase">
            What StealthPay does and does not hide
          </p>
          <Badge tone="ink" size="sm">
            Read before assuming more
          </Badge>
        </div>

        <div className="grid gap-0 sm:grid-cols-2">
          <div className="border-ink p-5 sm:border-r-[3px]">
            <div className="flex items-center gap-2">
              <EyeOff className="size-4" aria-hidden="true" />
              <SectionLabel>Unlinkable</SectionLabel>
            </div>
            <ul className="mt-4 space-y-2.5">
              {HIDDEN.map((h) => (
                <li key={h} className="flex gap-2.5">
                  <span
                    className="bg-lime border-ink mt-1.5 size-2.5 shrink-0 border-2"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed">{h}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-ink border-t-[3px] p-5 sm:border-t-0">
            <div className="flex items-center gap-2">
              <Eye className="size-4" aria-hidden="true" />
              <SectionLabel>Still fully public</SectionLabel>
            </div>
            <ul className="mt-4 space-y-2.5">
              {VISIBLE.map((v) => (
                <li key={v} className="flex gap-2.5">
                  <span
                    className="bg-coral border-ink mt-1.5 size-2.5 shrink-0 border-2"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="border-ink bg-paper-2 border-t-[3px] p-5 text-sm leading-relaxed">
          StealthPay provides{" "}
          <strong className="font-display">recipient identity
          unlinkability</strong>
          , not complete transaction anonymity. It is not a mixer, it does not
          provide confidential balances or amounts, and it does not use
          zero-knowledge proofs. It also does not provide sender anonymity or
          protection against sophisticated timing and amount correlation.
        </p>
      </div>
    </Section>
  );
}
