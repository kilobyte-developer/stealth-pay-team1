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
        description="Every announcement matched to your viewing key, with the balance verified against the chain."
      />

      <ActivityView />
    </>
  );
}
