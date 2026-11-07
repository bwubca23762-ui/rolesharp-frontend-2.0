import JsonLd from "./json-ld";
import FirstVisitCountry from "./first-visit-country";
import { env } from "@/lib/env";
import { ApplicationJourneyLoopLine, LandingClose, landingFaqs, ModernPlans } from "@/components/marketing";
import { RoleSharpLanding } from "@/components/marketing/RoleSharpLanding";
import { MarketingShell } from "@/components/ui/primitives";

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: landingFaqs.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default function Home() {
  return (
    <MarketingShell>
      <JsonLd data={FAQ_LD} />
      <FirstVisitCountry />
      <RoleSharpLanding>
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
        <LandingClose showClose={false} />
      </RoleSharpLanding>
    </MarketingShell>
  );
}
