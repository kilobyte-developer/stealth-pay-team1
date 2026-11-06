import type { Metadata } from "next";
import { ArrowDownToLine } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReceivePanel } from "@/components/payments/receive-panel";
import { ReceiveFlowDiagram } from "@/components/payments/receive-flow-diagram";
import { IncomingPayments } from "@/components/payments/incoming-payments";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Receive" };

export default function ReceivePage() {
  return (
    <>
      <PageHeader
        eyebrow="Receive"
        title="Receive Privately."
        description="Share your Stealth Meta-Address. Let senders generate a fresh destination for every payment."
        actions={
          <Badge tone="lime" size="md">
            <ArrowDownToLine className="size-3" aria-hidden="true" />
            One address published · unlimited destinations
          </Badge>
        }
      />

      <ReceivePanel />

      <ReceiveFlowDiagram />

      <IncomingPayments />
    </>
  );
}
