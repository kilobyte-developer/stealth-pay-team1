"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { NetworkCard } from "@/components/dashboard/network-card";
import { IdentityStatusCard } from "@/components/dashboard/identity-status-card";
import { PaymentsTable } from "@/components/payments/payments-table";
import { SectionLabel } from "@/components/ui/section-label";
import { buttonVariants } from "@/components/ui/button";
import { useStealthPayments } from "@/hooks/use-stealth-payments";

export function DashboardOverview() {
  const paymentsState = useStealthPayments();
  const recent = {
    ...paymentsState,
    payments: paymentsState.payments.slice(0, 5),
  };

  return (
    <div className="space-y-6">
      <BalanceCard />

      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-2">
        <IdentityStatusCard />
        <NetworkCard />
      </div>

      <section aria-labelledby="recent-payments-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SectionLabel id="recent-payments-heading" className="text-grey">
            Recent payments
          </SectionLabel>
          {paymentsState.payments.length > 0 ? (
            <Link
              href="/activity"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        <PaymentsTable {...recent} compact />
      </section>
    </div>
  );
}
