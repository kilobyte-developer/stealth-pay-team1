import type { Metadata } from "next";
import { DemoModeBanner, PageHeader } from "@/components/shared/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Configuration."
        description="Wallet, network, security posture and build information."
      />

      <DemoModeBanner />

      <SettingsView />
    </>
  );
}
