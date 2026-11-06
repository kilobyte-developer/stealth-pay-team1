"use client";

import * as React from "react";
import { ArrowRight, Fingerprint, KeyRound, Radar, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section, SectionHeading } from "@/components/landing/section";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  actor: string;
  icon: LucideIcon;
  summary: string;
  points: string[];
  formula: string;
  formulaNote: string;
}

const STEPS: Step[] = [
  {
    id: "identity",
    title: "Create Your Stealth Identity",
    actor: "Alice · Receiver",
    icon: Fingerprint,
    summary:
      "Alice generates two independent key pairs on their own device and publishes only their public halves.",
    points: [
      "A viewing key pair (a, A) that detects incoming payments.",
      "A spending key pair (b, B) that recovers control of one-time addresses.",
      "The Stealth Meta-Address (B, A) is safe to share as a QR code, link or string.",
      "Both private keys stay on the device — they are never sent to a sender or a backend.",
    ],
    formula: "A = a·G    B = b·G    Meta-Address = (B, A)",
    formulaNote: "Two key pairs on the SECP256k1 curve.",
  },
  {
    id: "derive",
    title: "Sender Generates a One-Time Address",
    actor: "Bob · Sender",
    icon: KeyRound,
    summary:
      "Using only Alice's public meta-address, Bob derives a fresh destination that has never existed before.",
    points: [
      "Bob generates a brand-new ephemeral key pair (r, R) for this payment only.",
      "Bob computes an ECDH shared secret from that ephemeral key and Alice's viewing key.",
      "That secret offsets Alice's spending key to produce a one-time stealth address.",
      "The payment and its ERC-5564 Announcement are emitted atomically in one transaction.",
    ],
    formula: "S = r·A    P = B + H(S)·G",
    formulaNote:
      "The ephemeral private key r is never published — only R travels on-chain.",
  },
  {
    id: "detect",
    title: "Receiver Detects the Payment",
    actor: "Alice · Receiver",
    icon: Radar,
    summary:
      "Alice's scanner reads announcements and, using their private viewing key, works out which one is theirs.",
    points: [
      "A cheap view-tag check discards announcements belonging to other receivers.",
      "For survivors, the same shared secret is recomputed from the announced ephemeral key.",
      "If the re-derived address matches the announced one, the payment belongs to Alice.",
      "The actual on-chain transfer is then verified — an announcement alone is never proof.",
    ],
    formula: "a·R = a·(r·G) = r·(a·G) = r·A",
    formulaNote:
      "Elliptic-curve Diffie–Hellman: both sides reach an identical secret.",
  },
  {
    id: "spend",
    title: "Spend Directly from the Stealth Address",
    actor: "Alice → John",
    icon: Send,
    summary:
      "Alice derives the one-time private key locally and sends the funds onward themselves.",
    points: [
      "The spending key and shared secret combine into the key for that single address.",
      "Derivation happens client-side; the key is never transmitted or stored in plaintext.",
      "Alice signs and broadcasts straight from the one-time account to John.",
      "Alice's primary wallet appears as neither sender nor receiver in either leg.",
    ],
    formula: "x = (b + H(S')) mod n",
    formulaNote: "x controls exactly one address, and nothing else.",
  },
];

export function HowItWorks() {
  const [active, setActive] = React.useState(0);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent) {
    const last = STEPS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next !== null) {
      e.preventDefault();
      setActive(next);
      tabRefs.current[next]?.focus();
    }
  }

  const step = STEPS[active];

  return (
    <Section id="how-it-works" tone="paper2" grid>
      <SectionHeading
        eyebrow="How it works"
        title="FOUR STEPS, ONE PRIVATE PAYMENT."
        lead="Select a step to see what happens on each side of the payment, and the cryptography behind it."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
        {/* Step tabs */}
        <div
          role="tablist"
          aria-label="How StealthPay works"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="flex flex-col gap-3"
        >
          {STEPS.map((s, i) => {
            const selected = i === active;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`how-tab-${s.id}`}
                aria-selected={selected}
                aria-controls={`how-panel-${s.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  "brutal-press border-ink flex w-full items-center gap-3 border-2 p-3.5 text-left",
                  selected
                    ? "bg-lime shadow-brutal-md"
                    : "shadow-brutal-xs hover:shadow-brutal-sm bg-white",
                )}
              >
                <span
                  className={cn(
                    "border-ink font-display grid size-9 shrink-0 place-items-center border-2 text-sm font-bold",
                    selected ? "bg-ink text-lime" : "bg-paper-2",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block text-sm leading-tight font-bold">
                    {s.title}
                  </span>
                  <span className="text-grey mt-0.5 block text-[0.7rem]">
                    {s.actor}
                  </span>
                </span>
                <Icon
                  className={cn("size-4 shrink-0", selected ? "" : "text-grey")}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div
          role="tabpanel"
          id={`how-panel-${step.id}`}
          aria-labelledby={`how-tab-${step.id}`}
          className="border-ink shadow-brutal border-[3px] bg-white p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="blue" size="md">
              Step {active + 1} of {STEPS.length}
            </Badge>
            <Badge tone="white" size="md">
              {step.actor}
            </Badge>
          </div>

          <h3 className="mt-4 text-2xl sm:text-3xl">{step.title}</h3>
          <p className="mt-3 text-base leading-relaxed">{step.summary}</p>

          <ul className="mt-6 space-y-2.5">
            {step.points.map((p) => (
              <li key={p} className="flex gap-3">
                <ArrowRight
                  className="mt-0.5 size-4 shrink-0 text-blue"
                  aria-hidden="true"
                />
                <span className="text-sm leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>

          <div className="border-ink bg-ink text-paper mt-6 border-2 p-4">
            <SectionLabel className="text-lime">Cryptography</SectionLabel>
            <p className="mt-2.5 font-mono text-sm break-words sm:text-base">
              {step.formula}
            </p>
            <p className="text-paper/60 mt-2 text-xs leading-relaxed">
              {step.formulaNote}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
