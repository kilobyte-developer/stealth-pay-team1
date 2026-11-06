import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DemoModeBanner, PageHeader } from "@/components/shared/page-header";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ScannerStatusCard } from "@/components/dashboard/scanner-status-card";
import { NetworkCard } from "@/components/dashboard/network-card";
import { IdentityStatusCard } from "@/components/dashboard/identity-status-card";
import { ActivityTable } from "@/components/payments/activity-table";
import { SectionLabel } from "@/components/ui/section-label";
import { buttonVariants } from "@/components/ui/button";
import { DemoTag } from "@/components/ui/demo-tag";
import { MOCK_TRANSACTIONS } from "@/data/mock/transactions";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const recent = MOCK_TRANSACTIONS.slice(0, 4);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Good morning."
        description="Your privacy-first payment command centre."
      />

      <DemoModeBanner />

      <BalanceCard />

      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-2">
        <IdentityStatusCard />
        <NetworkCard />
      </div>

      <ScannerStatusCard />

      <section aria-labelledby="recent-activity-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SectionLabel id="recent-activity-heading" className="text-grey">
              Recent activity
            </SectionLabel>
            <DemoTag />
          </div>
          <Link
            href="/activity"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <ActivityTable transactions={recent} />
      </section>
    </>
  );
}
