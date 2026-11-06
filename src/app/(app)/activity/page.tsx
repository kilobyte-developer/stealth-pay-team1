import type { Metadata } from "next";
import { DemoModeBanner, PageHeader } from "@/components/shared/page-header";
import { ActivityView } from "@/components/payments/activity-view";
import { DemoTag } from "@/components/ui/demo-tag";
import { MOCK_TRANSACTIONS } from "@/data/mock/transactions";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Activity"
        title="Transaction History."
        description="Every detected incoming payment and every onward transfer, with the announcement data behind each one."
        actions={<DemoTag label="Demo transactions" />}
      />

      <DemoModeBanner />

      <ActivityView transactions={MOCK_TRANSACTIONS} />
    </>
  );
}
