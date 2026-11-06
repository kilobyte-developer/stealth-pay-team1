import { Eye, KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { MonoBlock } from "@/components/ui/mono";
import { CopyButton } from "@/components/ui/copy-button";
import type { StealthIdentityPublic } from "@/lib/stealth";

export function MetaAddressCard({
  identity,
}: {
  identity: StealthIdentityPublic;
}) {
  const publicKeys = [
    {
      icon: KeyRound,
      label: "Public spending key",
      symbol: "B = b·G",
      value: identity.spendingPublicKey,
      note: "Offset by the shared secret to produce each one-time address.",
      tone: "bg-lime",
    },
    {
      icon: Eye,
      label: "Public viewing key",
      symbol: "A = a·G",
      value: identity.viewingPublicKey,
      note: "Lets a sender compute the shared secret for this payment.",
      tone: "bg-blue text-white",
    },
  ];

  return (
    <div className="border-ink shadow-brutal-md border-[3px] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel className="text-blue">
            Stealth meta-address
          </SectionLabel>
          <p className="text-grey mt-2 max-w-xl text-sm leading-relaxed">
            Share this once. Every sender uses it to derive a different
            destination, so it never needs to change.
          </p>
        </div>
        <Badge tone="lime" size="md">
          <ShieldCheck className="size-3" aria-hidden="true" />
          Safe to share
        </Badge>
      </div>

      {/* Full meta-address URI */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-[0.7rem] font-bold tracking-[0.16em] uppercase">
            Meta-address URI
          </p>
          <CopyButton
            value={identity.stealthMetaAddress}
            what="Meta-address"
            label="Copy"
            variant="primary"
            size="sm"
          />
        </div>
        <MonoBlock className="mt-2">{identity.stealthMetaAddress}</MonoBlock>
        <p className="text-grey mt-2 text-xs leading-relaxed">
          Encoded as{" "}
          <code className="font-mono">st:avax:0x&lt;B&gt;&lt;A&gt;</code> — the
          spending key precedes the viewing key, following the ERC-5564
          canonical ordering. Scheme ID {identity.schemeId} (SECP256k1).
        </p>
      </div>

      {/* Constituent public keys */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {publicKeys.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="border-ink border-2 p-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`border-ink grid size-9 shrink-0 place-items-center border-2 ${k.tone}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-xs leading-tight font-bold">
                    {k.label}
                  </p>
                  <p className="text-grey font-mono text-[0.65rem]">
                    {k.symbol}
                  </p>
                </div>
              </div>

              <MonoBlock className="mt-3 text-[0.65rem]">{k.value}</MonoBlock>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <p className="text-grey flex-1 text-[0.7rem] leading-relaxed">
                  {k.note}
                </p>
                <CopyButton
                  value={k.value}
                  what={k.label}
                  iconOnly
                  variant="outline"
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-ink bg-paper-2 mt-5 border-2 p-3 text-xs leading-relaxed">
        <strong className="font-display">Private keys are not shown here.</strong>{" "}
        Your private viewing and spending keys exist only in this browser
        session&apos;s memory. They are never rendered, serialized, logged or
        transmitted.
      </p>
    </div>
  );
}
