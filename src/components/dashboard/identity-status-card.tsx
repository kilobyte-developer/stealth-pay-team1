"use client";

import Link from "next/link";
import { ArrowRight, Fingerprint, Lock, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { MonoBlock } from "@/components/ui/mono";
import { CopyButton } from "@/components/ui/copy-button";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { NETWORKS } from "@/config/networks";
import { truncateMiddle } from "@/lib/format";

/** Dashboard summary of the session stealth identity, or a prompt to create one. */
export function IdentityStatusCard() {
  const { publicIdentity, createIdentity, lockIdentity, error } =
    useStealthIdentity();

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
              Not created yet
            </p>
          </div>
        </div>

        <p className="text-grey mt-4 text-sm leading-relaxed">
          Generate a stealth identity to get a shareable meta-address. Keys are
          created in your browser and held in memory for this session only.
        </p>

        {error ? (
          <p role="alert" className="text-coral-deep mt-3 text-sm font-bold">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" size="md" onClick={() => createIdentity()}>
            <Sparkles className="size-4" aria-hidden="true" />
            Create identity
          </Button>
          <Link
            href="/identity"
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            Learn about the keys
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
              Active this session
            </p>
          </div>
        </div>
        <Badge tone="lime" size="sm">
          Scheme {publicIdentity.schemeId}
        </Badge>
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
        Bound to {network?.shortName ?? `chain ${publicIdentity.chainId}`}. Lost
        on refresh — there is no backup in this build.
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
        <Button variant="ghost" size="sm" onClick={lockIdentity}>
          <Lock className="size-3.5" aria-hidden="true" />
          Lock
        </Button>
      </div>
    </div>
  );
}
