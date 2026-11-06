import type { LucideIcon } from "lucide-react";
import { EyeOff, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { MonoBlock } from "@/components/ui/mono";
import { CopyButton } from "@/components/ui/copy-button";

export function KeyPairCard({
  icon: Icon,
  name,
  symbols,
  tone,
  purpose,
  publicKey,
  publicKeyLabel,
  privateKeyRole,
}: {
  icon: LucideIcon;
  name: string;
  symbols: string;
  tone: string;
  purpose: string;
  publicKey: string;
  publicKeyLabel: string;
  privateKeyRole: string;
}) {
  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`border-ink grid size-11 shrink-0 place-items-center border-2 ${tone}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-base leading-tight font-bold">
              {name}
            </p>
            <p className="text-grey font-mono text-xs">{symbols}</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed">{purpose}</p>

      {/* Public half — safe to show */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel className="text-grey">{publicKeyLabel}</SectionLabel>
          <Badge tone="lime" size="xs">
            Safe to share
          </Badge>
        </div>
        <MonoBlock className="mt-2 text-[0.65rem]">{publicKey}</MonoBlock>
        <div className="mt-2">
          <CopyButton
            value={publicKey}
            what={publicKeyLabel}
            variant="outline"
            size="sm"
          />
        </div>
      </div>

      {/* Private half — never rendered, by design */}
      <div className="border-ink bg-paper-2 mt-5 border-2 border-dashed p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel className="text-coral-deep">Private half</SectionLabel>
          <Badge tone="muted" size="xs">
            <EyeOff className="size-2.5" aria-hidden="true" />
            Never displayed
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          <p
            className="font-mono text-sm tracking-[0.3em] select-none"
            aria-label="Private key hidden"
          >
            ••••••••••••••••
          </p>
        </div>

        <p className="text-grey mt-3 text-xs leading-relaxed">
          {privateKeyRole}
        </p>

        <p className="border-ink mt-3 border-2 bg-white p-2.5 text-[0.7rem] leading-relaxed">
          <strong className="font-display">
            Status in this preview: not generated.
          </strong>{" "}
          The public keys above are demo values. No private key exists in this
          build, so there is nothing to display, export or leak.
        </p>
      </div>
    </div>
  );
}
