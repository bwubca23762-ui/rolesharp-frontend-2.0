import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { FaqSection } from "@/app/seo-blocks";
import { Mail, Users } from "@/app/icons";
import { Button, Card, Container, MarketingShell, PageHeader, Section, SectionHeader } from "@/components/ui/primitives";
import { PARTNERSHIPS_EMAIL } from "@/lib/contact";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Affiliate & Referral Programs",
  description: "Earn resume credits by referring friends to RoleSharp, or join the creator affiliate early-access list. See eligibility rules and referral limits.",
  alternates: { canonical: "/affiliate" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Affiliate & Referral Programs",
    description: "Refer friends for resume credits, or apply for the creator affiliate early-access list.",
    url: "/affiliate",
  },
};

export default function AffiliatePage() {
  const base = env.siteUrl;
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${base}/affiliate#page`,
    url: `${base}/affiliate`,
    name: "RoleSharp Affiliate & Referral Programs",
    description: "RoleSharp's user referral program and creator affiliate early access.",
    isPartOf: { "@id": `${base}/#website` },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Affiliate", item: `${base}/affiliate` },
    ],
  };
  const faqs: [string, string][] = [
    ["How does the referral program work?", `Share your personal invite link from Settings → Credits. When someone signs up through the link and generates their first resume, you earn ${env.referralCreditReward} resume credit. The reward applies once per new user and up to ${env.referralMonthlyCap} qualifying referrals per rolling ${env.daysMonthly} days.`],
    ["What can credits buy?", "Credits raise your resume-generation allowance on the Free plan. They are earned, not purchased — Premium remains the paid path for higher volume."],
    ["Is there a cash affiliate program?", "A revenue-share program for creators, coaches, and publishers is in early access. Email partnerships to register your interest. Rates and terms are still being finalized."],
    ["Can I promote RoleSharp now?", "Yes. You can share the homepage or a free tool with your audience. For referral credits, use your personal invite link."],
  ];

  return (
    <MarketingShell className="growth-page growth-program">
      <JsonLd data={[pageLd, breadcrumbLd]} />

      <header className="relative border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
        <Container className="py-14 md:py-20">
          <PageHeader
            eyebrow="Affiliate & referral"
            title="Share RoleSharp with a friend"
            description={`Earn ${env.referralCreditReward} resume credit when someone uses your invite link and generates their first resume. Creators and publishers can also request early access to the upcoming affiliate program.`}
            actions={<><Button as="a" href="/settings?tab=credits">Get your invite link</Button><Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}?subject=RoleSharp%20affiliate%20early%20access`} variant="outline">Join creator early access</Button></>}
          />
        </Container>
      </header>

      <Section asContainer={false}>
        <Container>
          <SectionHeader title="How referral credits work" />
          <ol className="growth-list">
            <li><h3>1. Copy your invite link</h3><p>Open Settings → Credits and share your personal link with a friend.</p></li>
            <li><h3>2. Your friend builds a resume</h3><p>They sign up through your link and generate their first resume.</p></li>
            <li><h3>3. Check your credit balance</h3><p>{`Credits appear in Settings → Credits. You can earn the reward once per referred user, up to ${env.referralMonthlyCap} qualifying referrals per rolling ${env.daysMonthly} days.`}</p></li>
          </ol>
        </Container>
      </Section>

      <Section asContainer={false} alt>
        <Container>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card variant="elevated" padding="lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><Users size={21} /></span>
              <h2 className="mt-5 text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">For career creators & coaches</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">If you publish resume advice, run a career newsletter, or coach job seekers, the upcoming affiliate program will offer revenue share on Premium passes you refer. It is in early access — terms are being finalized, so there are no published commission rates yet. Join the list and you&apos;ll hear first, with real numbers.</p>
              <Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}?subject=RoleSharp%20affiliate%20early%20access`} variant="outline" size="sm" className="mt-5">Request early access</Button>
            </Card>
            <Card variant="dark" padding="lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--color-brand-amber)]"><Mail size={21} /></span>
              <h2 className="mt-5 text-2xl font-bold">What to include in your note</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">Tell us where you publish (newsletter, YouTube, blog, coaching practice), your audience size, and how you&apos;d recommend RoleSharp. We answer every serious inquiry and will tell you straight if the program isn&apos;t a fit yet.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}?subject=RoleSharp%20affiliate%20early%20access`} variant="primaryInverse">Email partnerships</Button><Button as="a" href="/tools" variant="outlineInverse">See the free tools</Button></div>
            </Card>
          </div>
        </Container>
      </Section>

      <FaqSection className="growth-faq" visible heading="Program questions" faqs={faqs} />
    </MarketingShell>
  );
}
