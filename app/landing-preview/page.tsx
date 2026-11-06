import type { Metadata } from "next";
import JsonLd from "../json-ld";
import FirstVisitCountry from "../first-visit-country";
import { env } from "@/lib/env";
import SocialProofBand from "../social-proof-band";
import CompanyMarquee from "../company-marquee";
import LandingMotion from "../landing-motion";
import "../landing-motion.css";
import {
  ApplicationJourneyLoopLine,
  LandingClose,
  landingFaqs,
  ModernPlans,
  ModernHeroAndMethod,
  ReferralAct,
  SmartTopBar,
  ProductDemoStage,
  MethodBento,
  CandidateTestimonials,
  ComparisonTable,
  FlagshipToolsSuite,
  TemplateStudio,
} from "@/components/marketing";
import { Container, MarketingShell } from "@/components/ui/primitives";
import { featuredPromo } from "@/lib/featured-promo";

export const metadata: Metadata = {
  title: "RoleSharp — Preview",
  robots: { index: false, follow: false },
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: landingFaqs.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default async function LandingPreviewPage() {
  const promo = await featuredPromo().catch(() => null);
  const promoLabel = promo
    ? promo.percentageOff != null
      ? `${promo.percentageOff}% off Premium`
      : promo.amountOffCents != null
        ? `$${(promo.amountOffCents / 100).toFixed(promo.amountOffCents % 100 === 0 ? 0 : 2)} off Premium`
        : null
    : null;

  return (
    <MarketingShell>
      <div className="bg-white dark:bg-[var(--color-dark-bg)]">
        <JsonLd data={FAQ_LD} />
        <LandingMotion />
        <FirstVisitCountry />

        {/* Act 0: Unified Smart Announcement Bar */}
        <SmartTopBar
          studentOfferEnabled={env.studentOfferEnabled}
          promoCode={promo && promoLabel ? promo.code : null}
          promoLabel={promoLabel}
          referralReward={env.referralCreditReward}
        />

        {/* Act 1: Upgraded Hero with Live Evidence Inspector & Instant Tools Dock */}
        <ModernHeroAndMethod />

        {/* Act 2: Compact Interactive Product Stage (ATS, Voice Mock Interview, Match, Tailor, Salary) */}
        <ProductDemoStage />

        {/* Act 3: Live Hiring Market & Company Proof Marquee */}
        <section className="border-b border-[var(--hairline)]">
          <CompanyMarquee />
          <Container size="large" className="pb-8">
            <SocialProofBand />
          </Container>
        </section>

        {/* Act 4: Flagship Profit & Conversion Suite (Core Tools) */}
        <FlagshipToolsSuite />

        {/* Act 5: Verified Candidate Testimonials */}
        <CandidateTestimonials />

        {/* Act 6: Direct Comparison Matrix (Generic AI vs RoleSharp) */}
        <ComparisonTable />

        {/* Act 6: Real-World ATS Template Studio */}
        <TemplateStudio />

        {/* Act 7: Anti-Hallucination & ATS Truth Bento */}
        <MethodBento />

        {/* Act 8: Application Journey & Fixed-Term Plans */}
        <ApplicationJourneyLoopLine />
        <ModernPlans
          freeMonthlyLimit={env.freeMonthlyLimit}
          premiumMonthlyLimit={env.premiumMonthlyLimit}
          studentMonthlyLimit={env.studentMonthlyLimit}
          priceMonthlyCents={env.priceMonthlyCents}
          priceYearlyCents={env.priceYearlyCents}
          daysMonthly={env.daysMonthly}
          daysYearly={env.daysYearly}
          studentOfferEnabled={env.studentOfferEnabled}
        />
        <ReferralAct />

        {/* Act 9: FAQ & High-Conversion Close */}
        <LandingClose />
      </div>
    </MarketingShell>
  );
}
