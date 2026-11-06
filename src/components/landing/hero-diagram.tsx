import { ArrowDown, ArrowRight, Eye, KeyRound, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

const STEALTH_ADDRESSES = [
  { short: "0x7Ae4…41Be", amount: "10 AVAX" },
  { short: "0x3F19…a9E7", amount: "2.5 AVAX" },
  { short: "0xB62f…6F23", amount: "0.75 AVAX" },
];

function Arrow({ className }: { className?: string }) {
  return (
    <>
      <ArrowRight
        className={cn("hidden size-6 shrink-0 lg:block", className)}
        aria-hidden="true"
      />
      <ArrowDown
        className={cn("size-6 shrink-0 lg:hidden", className)}
        aria-hidden="true"
      />
    </>
  );
}

/**
 * Explains the core mechanism visually: one sender, one derivation step, many
 * independent one-time addresses, and a receiver that public observers cannot
 * link back to those addresses.
 */
export function HeroDiagram() {
  return (
    <div className="border-ink bg-white shadow-brutal-lg border-[3px] p-4 sm:p-6">
      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-stretch lg:gap-5">
        {/* Sender */}
        <div className="border-ink bg-paper-2 shadow-brutal-xs w-full border-2 p-4 lg:w-52">
          <SectionLabel className="text-grey">Sender</SectionLabel>
          <div className="mt-3 flex items-center gap-2">
            <span className="border-ink grid size-8 place-items-center border-2 bg-white">
              <Wallet className="size-4" aria-hidden="true" />
            </span>
            <p className="font-display text-sm font-bold">Bob</p>
          </div>
          <p className="text-grey mt-3 font-mono text-[0.65rem] break-all">
            0xE41b…C72a
          </p>
          <p className="mt-3 text-xs leading-relaxed">
            Holds only Alice&apos;s public stealth meta-address.
          </p>
        </div>

        <Arrow className="self-center" />

        {/* Derivation */}
        <div className="border-ink bg-lime shadow-brutal w-full flex-1 border-[3px] p-4">
          <SectionLabel>One-time derivation</SectionLabel>
          <div className="mt-3 flex items-center gap-2">
            <span className="border-ink bg-ink text-lime grid size-8 place-items-center border-2">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            <p className="font-display text-sm font-bold">
              Fresh ephemeral key per payment
            </p>
          </div>
          <div className="border-ink mt-3 border-2 bg-white px-2.5 py-2 font-mono text-[0.7rem] sm:text-xs">
            P = B + H(r·A)·G
          </div>
          <p className="mt-3 text-xs leading-relaxed">
            Computed entirely in the sender&apos;s browser. No private key is
            ever shared.
          </p>
        </div>

        <Arrow className="self-center" />

        {/* One-time addresses */}
        <div className="w-full lg:w-60">
          <SectionLabel className="text-grey">
            Independent one-time addresses
          </SectionLabel>
          <ul className="mt-3 space-y-2">
            {STEALTH_ADDRESSES.map((a, i) => (
              <li
                key={a.short}
                className={cn(
                  "border-ink flex items-center justify-between gap-2 border-2 px-2.5 py-2",
                  i === 0 ? "bg-blue text-white" : "bg-white",
                )}
              >
                <span className="font-mono text-[0.7rem]">{a.short}</span>
                <span className="font-display text-[0.65rem] font-bold">
                  {a.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Receiver boundary + observers */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="border-ink border-2 border-dashed p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="lime" size="sm">
              Private viewing key
            </Badge>
            <p className="font-display text-sm font-bold">
              Alice detects all three
            </p>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed">
            Only the holder of the private viewing key can tell which
            announcements belong to them, and only the spending key can move the
            funds.
          </p>
        </div>

        <div className="border-ink bg-ink text-paper border-2 p-4">
          <SectionLabel className="text-coral">Public observers</SectionLabel>
          <div className="mt-3 flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="border-paper/40 grid size-7 place-items-center border-2"
              >
                <Eye className="size-3.5" aria-hidden="true" />
              </span>
            ))}
          </div>
          <p className="text-paper/70 mt-3 text-xs leading-relaxed">
            See the addresses and amounts, but not the link back to
            Alice&apos;s reusable wallet identity.
          </p>
        </div>
      </div>
    </div>
  );
}
