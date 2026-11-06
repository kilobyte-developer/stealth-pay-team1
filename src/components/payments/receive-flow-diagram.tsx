import { ArrowDown, ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

const STAGES = [
  {
    step: "1",
    title: "Sender takes your meta-address",
    body: "Only public key material — (B, A). Nothing about your wallet is revealed.",
    tone: "bg-white",
  },
  {
    step: "2",
    title: "Sender adds a fresh ephemeral key",
    body: "A new random keypair (r, R) is generated for this one payment.",
    tone: "bg-paper-2",
  },
  {
    step: "3",
    title: "A one-time address is derived",
    body: "P = B + H(r·A)·G — an address that has never existed before.",
    tone: "bg-lime",
  },
  {
    step: "4",
    title: "You detect it privately",
    body: "Your private viewing key recomputes the same secret and finds the payment.",
    tone: "bg-blue text-white",
  },
];

export function ReceiveFlowDiagram() {
  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <SectionLabel className="text-grey">
        What a sender does with it
      </SectionLabel>

      <ol className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {STAGES.map((s, i) => (
          <li key={s.step} className="flex flex-1 flex-col gap-3 lg:flex-row">
            <div
              className={cn(
                "border-ink flex-1 border-2 p-3.5",
                s.tone,
              )}
            >
              <span className="font-display border-ink inline-flex size-7 items-center justify-center border-2 bg-white text-xs font-bold text-ink">
                {s.step}
              </span>
              <p className="font-display mt-2.5 text-sm leading-tight font-bold">
                {s.title}
              </p>
              <p
                className={cn(
                  "mt-1.5 text-xs leading-relaxed",
                  s.tone.includes("text-white") ? "text-white/80" : "text-grey",
                )}
              >
                {s.body}
              </p>
            </div>

            {i < STAGES.length - 1 ? (
              <span
                className="flex shrink-0 items-center justify-center lg:px-0"
                aria-hidden="true"
              >
                <ArrowRight className="hidden size-5 lg:block" />
                <ArrowDown className="size-5 lg:hidden" />
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="border-ink bg-paper-2 mt-5 border-2 p-3 text-xs leading-relaxed">
        You never hand out a private key, and you never need to generate
        anything per payment — the sender does that work. One published
        meta-address serves an unlimited number of unlinkable payments.
      </p>
    </div>
  );
}
