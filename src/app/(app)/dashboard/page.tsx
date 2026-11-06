import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Your payments."
        description="Balances and payments are read directly from Avalanche and matched with your private viewing key."
      />

      <DashboardOverview />
    </>
  );
}
