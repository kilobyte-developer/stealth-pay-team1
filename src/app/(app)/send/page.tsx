import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SendForm } from "@/components/payments/send-form";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Send" };

export default function SendPage() {
  return (
    <>
      <PageHeader
        eyebrow="Send"
        title="Send Without Exposing Your Identity."
        description="Pay a stealth meta-address. A fresh one-time destination is derived for this payment alone, and the recipient's reusable wallet never appears in the transaction."
        actions={
          <Badge tone="muted" size="md">
            Native AVAX is MVP scope
          </Badge>
        }
      />

      <SendForm />
    </>
  );
}
