"use client";

import {
  IdentityGate,
  IdentitySessionBar,
} from "@/components/identity/identity-gate";
import { MetaAddressCard } from "@/components/payments/meta-address-card";
import { QrPanel } from "@/components/payments/qr-panel";
import { PaymentRequestForm } from "@/components/payments/payment-request-form";

/**
 * Receive-side identity surface. Everything here is derived from a real
 * in-session stealth identity — the QR code encodes the actual meta-address.
 */
export function ReceivePanel() {
  return (
    <IdentityGate>
      {(identity) => (
        <div className="space-y-6">
          <IdentitySessionBar identity={identity} />

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <MetaAddressCard identity={identity} />
            <QrPanel value={identity.stealthMetaAddress} />
          </div>

          <PaymentRequestForm metaAddress={identity.stealthMetaAddress} />
        </div>
      )}
    </IdentityGate>
  );
}
