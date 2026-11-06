import type { Metadata } from "next";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ScannerPanel } from "@/components/scanner/scanner-panel";
import { AnnouncementChecker } from "@/components/scanner/announcement-checker";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = { title: "Scanner" };

export default function ScannerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Scanner"
        title="Your Private Payment Radar."
        description="Announcements are public; knowing which one is yours is not. This is the process that turns a stream of anonymous announcements into your payment list."
      />

      <ScannerPanel />

      <AnnouncementChecker />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border-ink bg-ink text-paper border-2 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
            <SectionLabel className="text-lime">
              Where the viewing key lives
            </SectionLabel>
          </div>
          <p className="text-paper/75 mt-3 text-sm leading-relaxed">
            Matching an announcement requires your private viewing key. That
            computation happens in this browser — the key is handed to the
            scanner as a callback and never leaves the provider that owns it, so
            it never reaches a backend.
          </p>
          <p className="text-paper/75 mt-3 text-sm leading-relaxed">
            The trade-off is that scanning only runs while you are here with the
            vault unlocked. A continuously-running server-side scanner would
            need your viewing key, which is a decision we have not taken.
          </p>
        </div>

        <div className="border-ink border-2 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
            <SectionLabel className="text-coral-deep">
              An announcement is not a payment
            </SectionLabel>
          </div>
          <p className="mt-3 text-sm leading-relaxed">
            Announcing is permissionless — anyone can claim anything about any
            address. A view-tag hit and an address match only mean an
            announcement <em>addresses</em> you.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            So the scanner reads the actual balance at each matched address and
            discards anything holding nothing. Only verified balances appear in
            your payment list.
          </p>
        </div>
      </div>
    </>
  );
}
