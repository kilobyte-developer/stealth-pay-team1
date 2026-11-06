import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { IdentityPanel } from "@/components/identity/identity-panel";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Stealth Identity" };

export default function IdentityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Stealth identity"
        title="Your Identity. Your Keys. Your Privacy."
        description="Two independent key pairs: one that finds your payments, one that spends them. Separating them means scanning never requires the key that moves funds."
        actions={
          <Badge tone="lime" size="md">
            <ShieldCheck className="size-3" aria-hidden="true" />
            ERC-5564 scheme 1 · SECP256k1
          </Badge>
        }
      />

      <IdentityPanel />
    </>
  );
}
