"use client";

import {
  Fingerprint,
  Lock,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { NETWORKS } from "@/config/networks";
import type { StealthIdentityPublic } from "@/lib/stealth";

/**
 * Prompt shown when no stealth identity exists in this session.
 *
 * Generating one performs real SECP256k1 key generation in the browser using
 * the platform CSPRNG — nothing is simulated.
 */
export function IdentityEmptyState() {
  const { createIdentity, error } = useStealthIdentity();

  return (
    <div className="border-ink shadow-brutal-md border-[3px] bg-white p-6 sm:p-8">
      <span className="border-ink bg-lime grid size-14 place-items-center border-2">
        <Fingerprint className="size-7" aria-hidden="true" />
      </span>

      <SectionLabel className="text-blue mt-5">
        No stealth identity yet
      </SectionLabel>
      <h2 className="mt-3 text-2xl sm:text-3xl">
        Create your stealth identity.
      </h2>
      <p className="text-grey mt-3 max-w-xl text-sm leading-relaxed">
        This generates two independent SECP256k1 key pairs in your browser — a
        viewing key that finds your payments and a spending key that controls
        them — then builds the publishable meta-address from their public
        halves.
      </p>

      <ul className="mt-5 space-y-2">
        {[
          "Keys are generated locally with the platform CSPRNG.",
          "Private keys are never rendered, logged, stored or transmitted.",
          "They are held in memory for this session only.",
        ].map((line) => (
          <li key={line} className="flex gap-2.5 text-sm leading-relaxed">
            <span
              className="bg-lime border-ink mt-1.5 size-2.5 shrink-0 border-2"
              aria-hidden="true"
            />
            {line}
          </li>
        ))}
      </ul>

      <div className="border-ink bg-coral/25 mt-5 flex items-start gap-2.5 border-2 p-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-xs leading-relaxed">
          <strong className="font-display">No backup exists.</strong> Refreshing
          the page, closing the tab or locking the session destroys this
          identity permanently. A recovery mechanism is deliberately not part of
          this milestone.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-coral-deep mt-4 text-sm font-bold">
          {error}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        className="mt-6"
        onClick={() => createIdentity()}
      >
        <Sparkles className="size-4" aria-hidden="true" />
        Generate stealth identity
      </Button>
    </div>
  );
}

/** Session status strip: which chain the identity is bound to, plus lock. */
export function IdentitySessionBar({
  identity,
}: {
  identity: StealthIdentityPublic;
}) {
  const { lockIdentity, chainMismatch, activeChainName } = useStealthIdentity();
  const boundNetwork = Object.values(NETWORKS).find(
    (n) => n.chainId === identity.chainId,
  );

  return (
    <div className="border-ink flex flex-col gap-3 border-2 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="lime" size="md">
          <Fingerprint className="size-3" aria-hidden="true" />
          Live identity — session only
        </Badge>
        <Badge tone="white" size="md">
          Scheme {identity.schemeId} · SECP256k1
        </Badge>
        <Badge tone={chainMismatch ? "coral" : "paper"} size="md">
          Bound to {boundNetwork?.shortName ?? `chain ${identity.chainId}`}
        </Badge>
      </div>

      <Button variant="outline" size="sm" onClick={lockIdentity}>
        <Lock className="size-3.5" aria-hidden="true" />
        Lock &amp; destroy
      </Button>

      {chainMismatch ? (
        <p
          role="alert"
          className="border-ink bg-coral/25 w-full border-2 p-2.5 text-xs leading-relaxed sm:w-auto"
        >
          Wallet is on {activeChainName}, but this identity is bound to{" "}
          {boundNetwork?.shortName ?? `chain ${identity.chainId}`}. Addresses
          derive identically, but confirm the payment network before sending.
        </p>
      ) : null}
    </div>
  );
}

/** Renders `children` only when a session identity exists. */
export function IdentityGate({
  children,
}: {
  children: (identity: StealthIdentityPublic) => React.ReactNode;
}) {
  const { publicIdentity } = useStealthIdentity();
  if (!publicIdentity) return <IdentityEmptyState />;
  return <>{children(publicIdentity)}</>;
}
