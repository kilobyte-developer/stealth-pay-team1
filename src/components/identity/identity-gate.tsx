"use client";

import { Fingerprint, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IdentitySetup } from "@/components/vault/identity-setup";
import { UnlockScreen } from "@/components/vault/unlock-screen";
import { RecoveryStatusBadge } from "@/components/vault/recovery-status";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { NETWORKS } from "@/config/networks";
import type { StealthIdentityPublic } from "@/lib/stealth";

/**
 * Routes between the three identity states:
 *   no vault        → encrypted setup wizard
 *   vault, locked   → unlock screen
 *   vault, unlocked → the feature itself
 */
export function IdentityGate({
  children,
}: {
  children: (identity: StealthIdentityPublic) => React.ReactNode;
}) {
  const { publicIdentity, vaultExists, isLocked } = useStealthIdentity();

  if (publicIdentity) return <>{children(publicIdentity)}</>;
  if (vaultExists && isLocked) return <UnlockScreen />;
  return <IdentitySetup />;
}

/** Session status strip: chain binding, recovery readiness, lock control. */
export function IdentitySessionBar({
  identity,
}: {
  identity: StealthIdentityPublic;
}) {
  const { lock, chainMismatch, activeChainName, vaultStatus } =
    useStealthIdentity();
  const boundNetwork = Object.values(NETWORKS).find(
    (n) => n.chainId === identity.chainId,
  );

  return (
    <div className="border-ink flex flex-col gap-3 border-2 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="lime" size="md">
          <Fingerprint className="size-3" aria-hidden="true" />
          Identity unlocked
        </Badge>
        <Badge tone="white" size="md">
          Scheme {identity.schemeId} · SECP256k1
        </Badge>
        <Badge tone={chainMismatch ? "coral" : "paper"} size="md">
          Bound to {boundNetwork?.shortName ?? `chain ${identity.chainId}`}
        </Badge>
        {vaultStatus ? (
          <RecoveryStatusBadge status={vaultStatus.recoveryStatus} size="md" />
        ) : null}
      </div>

      <Button variant="outline" size="sm" onClick={lock}>
        <Lock className="size-3.5" aria-hidden="true" />
        Lock
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
