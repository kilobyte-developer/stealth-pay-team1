"use client";

import { SectionLabel } from "@/components/ui/section-label";
import { PaymentsTable } from "@/components/payments/payments-table";
import { useStealthPayments } from "@/hooks/use-stealth-payments";

export function IncomingPayments() {
  const state = useStealthPayments();

  return (
    <section aria-labelledby="incoming-heading">
      <SectionLabel id="incoming-heading" className="text-grey mb-3">
        Incoming payments
      </SectionLabel>
      <PaymentsTable {...state} />
    </section>
  );
}
