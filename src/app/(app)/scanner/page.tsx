import type { Metadata } from "next";
import { Radar, ShieldCheck, TriangleAlert } from "lucide-react";
import { DemoModeBanner, PageHeader } from "@/components/shared/page-header";
import { ScannerConsole } from "@/components/scanner/scanner-console";
import { AnnouncementChecker } from "@/components/scanner/announcement-checker";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Scanner" };

export default function ScannerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Scanner"
        title="Your Private Payment Radar."
        description="Announcements are public; knowing which one is yours is not. This is the process that turns a stream of anonymous announcements into your payment list."
        actions={
          <Badge tone="coral" size="md">
            <Radar className="size-3" aria-hidden="true" />
            Simulated — no RPC scanning
          </Badge>
        }
      />

      <DemoModeBanner />

      {/* Real ERC-5564 matching against the session identity. */}
      <AnnouncementChecker />

      <ScannerConsole />

      {/* Architecture honesty */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border-ink bg-ink text-paper border-2 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
            <SectionLabel className="text-lime">
              Where the viewing key lives
            </SectionLabel>
          </div>
          <p className="text-paper/75 mt-3 text-sm leading-relaxed">
            Matching an announcement requires the private viewing key. In
            StealthPay that computation is designed to happen in the
            receiver&apos;s own client, so the key never reaches an ordinary
            backend API.
          </p>
          <p className="text-paper/75 mt-3 text-sm leading-relaxed">
            A continuously-running server-side scanner would need that key to
            work while you are offline. That trade-off is a deliberate open
            decision, not something this preview quietly assumes.
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
            Anyone can emit an announcement claiming anything. A match on the
            view tag and the derived address only means an announcement{" "}
            <em>addresses</em> you.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            Before a payment is shown as received, the real asset transfer to
            that stealth address must be verified on-chain. The final pipeline
            stage above exists for exactly that reason.
          </p>
        </div>
      </div>
    </>
  );
}
