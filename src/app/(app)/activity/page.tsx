import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityView } from "@/components/payments/activity-view";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Activity"
        title="Payment history."
        description="Payments received, sent, and forwarded — detected announcements verified on-chain, plus sends and forwards this browser made."
      />

      <ActivityView />
    </>
  );
}
