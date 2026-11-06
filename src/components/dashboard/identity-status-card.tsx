"use client";

import Link from "next/link";
import { ArrowRight, Fingerprint, Lock, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { MonoBlock } from "@/components/ui/mono";
import { CopyButton } from "@/components/ui/copy-button";
import { RecoveryStatusBadge } from "@/components/vault/recovery-status";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { NETWORKS } from "@/config/networks";
import { truncateMiddle } from "@/lib/format";

/** Dashboard summary of the session stealth identity, or a prompt to create one. */
export function IdentityStatusCard() {
  const { publicIdentity, isLocked, vaultStatus, lock } = useStealthIdentity();

  if (!publicIdentity) {
    return (
      <div className="border-ink shadow-brutal border-2 border-dashed bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="border-ink bg-paper-2 grid size-10 shrink-0 place-items-center border-2">
            <Fingerprint className="size-5" aria-hidden="true" />
          </span>
          <div>
            <SectionLabel className="text-grey">Stealth identity</SectionLabel>
            <p className="font-display mt-1 text-sm font-bold">
              {isLocked ? "Locked" : "Not created yet"}
            </p>
          </div>
        </div>

        <p className="text-grey mt-4 text-sm leading-relaxed">
          {isLocked
            ? "An encrypted vault exists on this device. Unlock it to use your identity."
            : "Generate a stealth identity to get a shareable meta-address. Your keys are encrypted with a vault password before anything is stored."}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/identity"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {isLocked ? "Unlock identity" : "Create identity"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  const network = Object.values(NETWORKS).find(
    (n) => n.chainId === publicIdentity.chainId,
  );

  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="border-ink bg-lime grid size-10 shrink-0 place-items-center border-2">
            <Fingerprint className="size-5" aria-hidden="true" />
          </span>
          <div>
            <SectionLabel className="text-grey">Stealth identity</SectionLabel>
            <p className="font-display mt-1 text-sm font-bold">
              Unlocked
            </p>
          </div>
        </div>
        {vaultStatus ? (
          <RecoveryStatusBadge status={vaultStatus.recoveryStatus} size="sm" />
        ) : (
          <Badge tone="lime" size="sm">
            Scheme {publicIdentity.schemeId}
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <p className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
          Meta-address
        </p>
        <MonoBlock className="mt-1.5 text-[0.65rem]">
          {truncateMiddle(publicIdentity.stealthMetaAddress, 28, 12)}
        </MonoBlock>
      </div>

      <p className="text-grey mt-3 text-xs leading-relaxed">
        Bound to {network?.shortName ?? `chain ${publicIdentity.chainId}`}.
        Encrypted on this device — a refresh locks it rather than losing it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton
          value={publicIdentity.stealthMetaAddress}
          what="Meta-address"
          variant="secondary"
          size="sm"
        />
        <Link
          href="/receive"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Share
        </Link>
        <Button variant="ghost" size="sm" onClick={lock}>
          <Lock className="size-3.5" aria-hidden="true" />
          Lock
        </Button>
      </div>
    </div>
  );
}
