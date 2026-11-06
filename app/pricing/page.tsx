import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import { FaqSection } from "../seo-blocks";
import { Button, Container, MarketingShell } from "@/components/ui/primitives";
import JsonLd from "../json-ld";
import { env } from "@/lib/env";
import { breadcrumbLd } from "@/lib/seo";
import { formatPlanPrice, tailoredResumes } from "@/lib/limits";

export const metadata: Metadata = {
  title: "Pricing — Start Free",
  description:
    `Get ${tailoredResumes(env.freeMonthlyLimit)} free per rolling month. Premium is a one-time ${env.daysMonthly}-day or ${env.daysYearly}-day pass with ${env.premiumMonthlyLimit} monthly generations, clear limits, and no auto-renewal.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Pricing — Start Free",
    description:
      `Start with ${tailoredResumes(env.freeMonthlyLimit)} free per rolling month. Buy Premium once for ${env.daysMonthly} or ${env.daysYearly} days; it never auto-renews.`,
    url: "/pricing",
  },
};

const PRICING_FAQS: [string, string][] = [
  [
    "Is RoleSharp really free?",
    `Yes. The free plan gives you ${env.freeMonthlyLimit} company-tailored ${env.freeMonthlyLimit === 1 ? "resume" : "resumes"} every month, unlimited ATS checks, the LinkedIn checker, the manual resume maker, and PDF downloads. No card is required to sign up or generate. Invite a friend to earn credits for more.`,
  ],
  [
    "How does the student offer work?",
    `When enrollment is open, verify an eligible university email for six months of Student Premium. It includes ${tailoredResumes(env.studentMonthlyLimit)} per month, clean PDF exports, cover letters, and student-focused Daily Matches. Paid Premium adds DOCX export, tool history, and full-market Daily Matches.`,
  ],
  [
    "What does Premium add?",
    `A $${env.priceMonthlyCents / 100} ${env.daysMonthly}-day Premium pass or $${env.priceYearlyCents / 100} ${env.daysYearly}-day Premium pass raises the allowance to ${tailoredResumes(env.premiumMonthlyLimit)} per rolling month and unlocks cover letters, interview prep, the LinkedIn summary writer, DOCX export, and every resume template. Each pass is paid once and never auto-renews.`,
  ],
  [
    "How do I pay?",
    "Choose the payment method that suits you at checkout: cryptocurrency through NOWPayments (quoted in USD) or card and UPI through Razorpay (quoted in INR). Your Premium pass activates after the selected provider confirms payment.",
  ],
  [
    "Can I cancel anytime? Does Premium auto-renew?",
    `Premium is a fixed-term pass: ${env.daysMonthly} days for the shorter option or ${env.daysYearly} days for the longer option. Each is paid once, never auto-renews, and creates no recurring charge to cancel. When the term ends, the account returns to Free and saved resumes remain available.`,
  ],
  [
    "What is the refund policy?",
    "Refund requests are reviewed for accidental purchases, duplicate payments, or paid access that never activated. Completed generations and downloaded Premium exports may not qualify. See the refund policy page and contact support with your account email and payment details.",
  ],
  [
    "What counts as one tailored resume?",
    "One AI generation targeted at a specific company, role, and job description counts as one tailored resume against your monthly limit. Re-checking your score, editing in the manual maker, and re-downloading an existing resume do not use up a generation.",
  ],
  [
    "Can I earn free resumes without paying?",
    `Yes. Each referral earns ${env.referralCreditReward} resume credit when the invited user generates their first resume, up to ${env.referralMonthlyCap} credits per rolling ${env.daysMonthly} days.`,
  ],
  [
    "What happens if I hit my monthly limit?",
    "Generation pauses until your month resets, or you can use earned credits or upgrade to Premium. The checker tools stay available.",
  ],
];

export default function PricingPage() {
  const plans = [
    { id: "free", title: "Free", price: "$0", term: "No card required", href: "/build" },
    { id: "monthly", title: `${env.daysMonthly}-day pass`, price: formatPlanPrice(env.priceMonthlyCents), term: `One payment for ${env.daysMonthly} days`, href: "/settings?tab=billing&plan=monthly" },
    { id: "yearly", title: `${env.daysYearly}-day pass`, price: formatPlanPrice(env.priceYearlyCents), term: `One payment for ${env.daysYearly} days`, href: "/settings?tab=billing&plan=yearly" },
  ];
  return (
    <MarketingShell className="growth-page growth-pricing">
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Pricing", item: "/pricing" }])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "RoleSharp",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: `${env.siteUrl}/pricing`,
          description: `AI resume builder that tailors your resume to a specific company, role, and country, with a free ATS-readiness score on every version. Free tier: ${tailoredResumes(env.freeMonthlyLimit)} per rolling month. Premium: a one-time $${env.priceMonthlyCents / 100} ${env.daysMonthly}-day or $${env.priceYearlyCents / 100} ${env.daysYearly}-day pass, never auto-renewed.`,
          offers: [
            {
              "@type": "Offer",
              name: "Free",
              price: "0",
              priceCurrency: "USD",
              description: `${tailoredResumes(env.freeMonthlyLimit)} per rolling month, unlimited ATS checks, PDF export. No card required.`,
            },
            {
              "@type": "Offer",
              name: `Premium ${env.daysMonthly}-day pass`,
              price: String(env.priceMonthlyCents / 100),
              priceCurrency: "USD",
              description: `${tailoredResumes(env.premiumMonthlyLimit)} per rolling month for ${env.daysMonthly} days. Paid once; never auto-renews.`,
            },
            {
              "@type": "Offer",
              name: `Premium ${env.daysYearly}-day pass`,
              price: String(env.priceYearlyCents / 100),
              priceCurrency: "USD",
              description: `${tailoredResumes(env.premiumMonthlyLimit)} per rolling month for ${env.daysYearly} days. Paid once; never auto-renews.`,
            },
          ],
        }}
      />

      <section className="desk-pricing">
        <Container>
          <header className="growth-opening mb-9 border-b border-[var(--border)] pb-6">
            <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-bold! tracking-tight!">Start free. Pay once if you need more.</h1>
            <p className="mt-3 text-base text-[var(--muted-fg)]">Premium never auto-renews. Your account returns to Free when the pass expires.</p>
          </header>
          <div className="desk-plan-grid">
            {plans.map(({ id, title, price, term, href }) => {
              const free = id === "free";
              return (
                <section className="desk-plan" key={id}>
                  <p className="text-sm font-semibold text-[var(--muted-fg)]">{free ? "Free account" : "Premium"}</p>
                  <h2 className="text-xl!">{free ? "Free plan" : title}</h2>
                  <p className="my-2 text-5xl font-bold tabular-nums">{price}</p>
                  <p className="mb-5 text-sm text-[var(--muted-fg)]">{term}</p>
                  <Button as="a" href={href} variant={free ? "outline" : "primary"}>{free ? "Start free" : `Choose ${title}`}</Button>
                  <dl className="mt-6">
                    <div><dt>Tailored resumes</dt><dd>{tailoredResumes(free ? env.freeMonthlyLimit : env.premiumMonthlyLimit)} per rolling month</dd></div>
                    <div><dt>Export formats</dt><dd>{free ? "PDF" : "PDF and DOCX"}</dd></div>
                    <div><dt>ATS checks</dt><dd>Included</dd></div>
                    <div><dt>Premium tools</dt><dd>{free ? "Available with Premium" : "Cover letters, templates and interview prep"}</dd></div>
                  </dl>
                </section>
              );
            })}
          </div>
          <section id="student-access" className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-6">
            <div>
              <h2 className="text-xl!">Studying or active university student?</h2>
              <p className="mt-1 text-[var(--muted-fg)]">{env.studentOfferEnabled ? "Check your eligibility for free Student Premium." : "New Student Premium enrollments are currently paused."}</p>
            </div>
            <Button as="a" href="/students" variant="outline">View student access</Button>
          </section>
          <a href="/compare" className="desk-link mt-5">Compare RoleSharp with other builders</a>
        </Container>
      </section>

      <FaqSection className="growth-faq" id="faq" visible heading="Pricing — common questions" faqs={PRICING_FAQS} />
    </MarketingShell>
  );
}
