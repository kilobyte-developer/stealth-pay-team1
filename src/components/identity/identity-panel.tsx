"use client";

import { Eye, KeyRound, Lock } from "lucide-react";
import {
  IdentityGate,
  IdentitySessionBar,
} from "@/components/identity/identity-gate";
import { KeyPairCard } from "@/components/identity/key-pair-card";
import { IdentityActions } from "@/components/identity/identity-actions";
import { MetaAddressCard } from "@/components/payments/meta-address-card";
import { QrPanel } from "@/components/payments/qr-panel";
import { SectionLabel } from "@/components/ui/section-label";
import { DataList, DataRow } from "@/components/ui/mono";
import { NETWORKS } from "@/config/networks";

const SECURITY_RULES = [
  {
    title: "Private keys stay under your control",
    body: "Viewing and spending keys are generated and used in your browser. They are never sent to a backend API or written to a database.",
  },
  {
    title: "Never share a private key",
    body: "No sender, support process or StealthPay feature will ever need it. A request for one is an attack.",
  },
  {
    title: "Public keys are safe to publish",
    body: "Your meta-address is only public key material. Sharing it widely is the intended use.",
  },
  {
    title: "Addresses are generated per payment",
    body: "You never reuse a destination, so no observer can cluster your incoming payments by address.",
  },
];

export function IdentityPanel() {
  return (
    <IdentityGate>
      {(identity) => {
        const network = Object.values(NETWORKS).find(
          (n) => n.chainId === identity.chainId,
        );

        return (
          <div className="space-y-6">
            <IdentitySessionBar identity={identity} />

            {/* The two key pairs */}
            <div className="grid gap-6 lg:grid-cols-2">
              <KeyPairCard
                icon={Eye}
                name="Viewing key"
                symbols="(a, A)  ·  A = a·G"
                tone="bg-blue text-white"
                purpose="Used to identify incoming payments by scanning blockchain announcements."
                publicKey={identity.viewingPublicKey}
                publicKeyLabel="Public viewing key (A)"
                privateKeyRole="The private viewing key recomputes the shared secret for every announcement, revealing which payments are yours. It cannot move funds — which is why a watch-only scanning setup is possible."
              />

              <KeyPairCard
                icon={KeyRound}
                name="Spending key"
                symbols="(b, B)  ·  B = b·G"
                tone="bg-lime"
                purpose="Used to derive control of your one-time receiving addresses."
                publicKey={identity.spendingPublicKey}
                publicKeyLabel="Public spending key (B)"
                privateKeyRole="The private spending key combines with the shared secret as x = (b + H(S')) mod n to produce the key for a single one-time address. It is used only at the moment you spend."
              />
            </div>

            {/* Meta-address */}
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
              <MetaAddressCard identity={identity} />
              <QrPanel
                value={identity.stealthMetaAddress}
                caption="Scan to import this meta-address into a sender's wallet."
              />
            </div>

            {/* Scheme + chain context */}
            <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
              <SectionLabel className="text-grey">
                Scheme &amp; network context
              </SectionLabel>
              <DataList className="mt-3">
                <DataRow label="Scheme ID" mono>
                  {identity.schemeId} (ERC-5564 SECP256k1)
                </DataRow>
                <DataRow label="Curve" mono={false}>
                  SECP256k1
                </DataRow>
                <DataRow label="Bound chain" mono={false}>
                  {network ? `${network.name} · chain ${network.chainId}` : identity.chainId}
                </DataRow>
                <DataRow label="Key encoding" mono={false}>
                  33-byte SEC1 compressed public keys
                </DataRow>
              </DataList>
            </div>

            <IdentityActions />

            {/* Security guidance */}
            <section aria-labelledby="key-security-heading">
              <div className="border-ink shadow-brutal-md border-[3px] bg-white">
                <div className="border-ink bg-ink text-paper flex flex-wrap items-center gap-3 border-b-[3px] p-4">
                  <Lock className="size-5" aria-hidden="true" />
                  <SectionLabel id="key-security-heading" className="text-lime">
                    Key security
                  </SectionLabel>
                </div>

                <div className="grid sm:grid-cols-2">
                  {SECURITY_RULES.map((r, i) => (
                    <div
                      key={r.title}
                      className={`border-ink/15 p-5 ${
                        i % 2 === 0 ? "sm:border-r-2" : ""
                      } ${i < SECURITY_RULES.length - 2 ? "border-b-2" : ""}`}
                    >
                      <p className="font-display text-sm font-bold">{r.title}</p>
                      <p className="text-grey mt-1.5 text-sm leading-relaxed">
                        {r.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        );
      }}
    </IdentityGate>
  );
}
