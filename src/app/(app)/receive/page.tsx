import type { Metadata } from "next";
import { ArrowDownToLine } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReceivePanel } from "@/components/payments/receive-panel";
import { ReceiveFlowDiagram } from "@/components/payments/receive-flow-diagram";
import { ActivityTable } from "@/components/payments/activity-table";
import { SectionLabel } from "@/components/ui/section-label";
import { DemoTag } from "@/components/ui/demo-tag";
import { Badge } from "@/components/ui/badge";
import { MOCK_TRANSACTIONS } from "@/data/mock/transactions";

export const metadata: Metadata = { title: "Receive" };

export default function ReceivePage() {
  const incoming = MOCK_TRANSACTIONS.filter((t) => t.direction === "incoming");

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

      {/* Real ERC-5564 identity generated in-browser. */}
      <ReceivePanel />

      <ReceiveFlowDiagram />

      <section aria-labelledby="incoming-heading">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SectionLabel id="incoming-heading" className="text-grey">
            Incoming payments
          </SectionLabel>
          <DemoTag />
        </div>
        <p className="text-grey mb-3 max-w-2xl text-xs leading-relaxed">
          Payment history is still demo data — live announcement scanning
          arrives with the contract and scanner milestone. The identity and
          meta-address above are real.
        </p>

        <ActivityTable
          transactions={incoming}
          emptyHint="Detected payments appear here once the scanner matches an announcement to your viewing key."
        />
      </section>
    </>
  );
}
