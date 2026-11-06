import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { Solution } from "@/components/landing/solution";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Security } from "@/components/landing/security";
import { AvalancheSection } from "@/components/landing/avalanche";
import { FinalCta } from "@/components/landing/final-cta";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Features />
        <Security />
        <AvalancheSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
