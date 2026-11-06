import {
  Blocks,
  Coins,
  Fingerprint,
  Layers,
  Radar,
  Send,
  Shuffle,
  Snowflake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section, SectionHeading } from "@/components/landing/section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Scope = "mvp" | "planned";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  scope: Scope;
  accent: "lime" | "blue" | "coral" | "white";
}

const FEATURES: Feature[] = [
  {
    icon: Shuffle,
    title: "One-time stealth addresses",
    body: "Every payment lands on a freshly derived address that has never been used before and never will be again.",
    scope: "mvp",
    accent: "lime",
  },
  {
    icon: Radar,
    title: "Private payment detection",
    body: "Your private viewing key identifies which on-chain announcements are yours. Nobody else can tell.",
    scope: "mvp",
    accent: "blue",
  },
  {
    icon: Fingerprint,
    title: "Reusable stealth identity",
    body: "Publish one Stealth Meta-Address forever. It produces unlimited unlinkable destinations.",
    scope: "mvp",
    accent: "white",
  },
  {
    icon: Send,
    title: "Direct spending",
    body: "Derive the one-time key locally and send funds straight onward. No sweeping through your main wallet.",
    scope: "mvp",
    accent: "coral",
  },
  {
    icon: Coins,
    title: "Native AVAX payments",
    body: "The MVP target: send and receive native AVAX on the Avalanche C-Chain.",
    scope: "mvp",
    accent: "white",
  },
  {
    icon: Layers,
    title: "ERC-20 payments",
    body: "Token support requires solving gas funding for token-only stealth accounts. Designed, not yet built.",
    scope: "planned",
    accent: "white",
  },
  {
    icon: Blocks,
    title: "ERC-5564 compatibility",
    body: "Standard announcement interface and SECP256k1 derivation, so other compliant tooling interoperates.",
    scope: "mvp",
    accent: "blue",
  },
  {
    icon: Snowflake,
    title: "Avalanche integration",
    body: "Contracts and payments run on the Avalanche C-Chain, demonstrated end to end on Fuji.",
    scope: "mvp",
    accent: "lime",
  },
];

const ACCENT = {
  lime: "bg-lime",
  blue: "bg-blue text-white",
  coral: "bg-coral",
  white: "bg-paper-2",
};

export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="Core features"
        title="BUILT FOR ONE JOB: UNLINKABLE RECEIVING."
        lead="StealthPay deliberately solves a single problem well rather than bundling unrelated privacy machinery. Scope labels below separate the MVP target from planned work."
      />

      <div className="border-ink shadow-brutal-sm mt-8 inline-flex flex-wrap items-center gap-3 border-2 bg-white px-4 py-3">
        <Badge tone="lime" size="sm">
          MVP scope
        </Badge>
        <span className="text-grey text-xs">Available now on Fuji</span>
        <span className="bg-ink/15 hidden h-5 w-0.5 sm:block" />
        <Badge tone="muted" size="sm">
          Planned
        </Badge>
        <span className="text-grey text-xs">
          Designed and documented, built after the MVP
        </span>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const planned = f.scope === "planned";
          return (
            <div
              key={f.title}
              className={cn(
                "border-ink flex flex-col border-2 bg-white p-5",
                planned ? "shadow-brutal-xs border-dashed" : "shadow-brutal-sm",
              )}
            >
              <span
                className={cn(
                  "border-ink grid size-11 place-items-center border-2",
                  ACCENT[f.accent],
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>

              <p className="font-display mt-4 text-base leading-tight font-bold">
                {f.title}
              </p>
              <p className="text-grey mt-2 flex-1 text-sm leading-relaxed">
                {f.body}
              </p>

              <div className="mt-4">
                <Badge tone={planned ? "muted" : "lime"} size="xs">
                  {planned ? "Planned" : "MVP scope"}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-ink bg-paper-2 mt-8 border-2 p-4 text-sm leading-relaxed">
        <strong className="font-display">Scope:</strong> StealthPay targets
        native AVAX first. ERC-20 payments are supported by the payment router
        but need native AVAX at the destination before the tokens can be moved,
        which is why they are listed separately above.
      </p>
    </Section>
  );
}
