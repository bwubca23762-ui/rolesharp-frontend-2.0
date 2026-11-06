import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { env } from "@/lib/env";
import { FREE_CERTIFICATIONS } from "@/lib/certifications-registry";
import { Card, Container, MarketingShell, PageHeader, Section, SectionHeader } from "@/components/ui/primitives";
import CertificationsCatalog from "./certifications-catalog";

const DESCRIPTION = "Find free courses that award a certificate, shareable badge, or verified credential. Explore official providers and add credentials you have earned to your resume.";

export const metadata: Metadata = {
  title: "Free Certifications & Courses for Your Resume",
  description: DESCRIPTION,
  alternates: { canonical: "/free-certifications" },
  openGraph: { type: "website", images: ["/opengraph-image"], title: "Free Certifications & Courses | RoleSharp", description: DESCRIPTION, url: "/free-certifications" },
};

const FAQS = [
  ["Are all the courses and credentials listed here free?", "We include programs whose official provider information says the course and its certificate, badge, or credential are free. Some require a free account or course completion. Read the requirements on each card and provider page before starting."],
  ["Are course certificates the same as professional certifications?", "No. The catalog labels certificates, digital badges, and applied credentials separately. A course completion credential is evidence of learning; it does not replace a regulated or exam-based professional certification."],
  ["Can I add a course to my resume before I finish it?", "The resume builder only inserts an item after you confirm that you completed the program and earned the credential. Add a completion year or evidence only when it is accurate."],
  ["Does RoleSharp issue these credentials?", "No. The listed provider issues and verifies the credential. RoleSharp links to the provider and helps you format a credential you have already earned."],
] as const;

export default function FreeCertificationsPage() {
  const base = env.siteUrl;
  const pageUrl = `${base}/free-certifications`;
  const collectionLd = {
    "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${pageUrl}#page`, url: pageUrl,
    name: "Free Certifications and Courses", description: DESCRIPTION,
    mainEntity: { "@type": "ItemList", numberOfItems: FREE_CERTIFICATIONS.length, itemListElement: FREE_CERTIFICATIONS.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title, url: item.url })) },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Free Certifications", item: pageUrl },
    ],
  };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) };

  return <MarketingShell>
    <JsonLd data={[collectionLd, breadcrumbLd, faqLd]} />
    <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
      <Container className="relative z-10 py-14 md:py-20">
        <PageHeader eyebrow="Free learning · provider-issued credentials" title="Learn the skill. Earn the proof. Show it on your resume." description="Find genuinely free courses and credentials from established providers. Every listing links to its official source, and the resume builder only adds credentials you confirm you have earned." className="mb-0" />
        <div className="mt-7 flex flex-wrap gap-2 text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"><span className="rounded-full border border-[var(--color-border)] px-3 py-1.5 dark:border-[var(--color-dark-border)]">{FREE_CERTIFICATIONS.length} provider-verified programs</span><span className="rounded-full border border-[var(--color-border)] px-3 py-1.5 dark:border-[var(--color-dark-border)]">Certificates, badges & applied credentials</span><span className="rounded-full border border-[var(--color-border)] px-3 py-1.5 dark:border-[var(--color-dark-border)]">No RoleSharp account required</span></div>
      </Container>
    </section>

    <Section asContainer={false}>
      <Container>
        <SectionHeader eyebrow="Browse the directory" title="Choose a credential that fits your next step" description="Filter by topic, provider, or estimated study time. Course durations are estimates; providers control their courses and credential requirements." />
        <CertificationsCatalog />
        <p className="mt-6 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Listings were reviewed on September 25, 2026. Provider terms and course availability can change; check the official page before enrolling. “Free” refers to the listed course and credential, and may require a free account, coursework, or an assessment.</p>
      </Container>
    </Section>

    <Section asContainer={false} alt>
      <Container size="small">
        <SectionHeader eyebrow="Use your learning honestly" title="A credential is evidence. Your work is the story." description="List the exact credential only after earning it. Pair it with a project or assessment you actually completed; never claim experience just because you studied a topic." align="center" className="mb-7" />
        <div className="space-y-3">{FAQS.map(([question, answer]) => <details key={question} className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 open:p-5 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]"><summary className="cursor-pointer list-none font-semibold text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)] dark:text-[var(--color-dark-text)]">{question}<span aria-hidden="true" className="float-right ml-4 text-[var(--color-primary)]">+</span></summary><p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{answer}</p></details>)}</div>
        <Card padding="lg" className="mt-7 text-center"><p className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Already earned a credential?</p><p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Add it to your resume builder, then include a real project or assessment that shows how you used the skill.</p><div className="mt-4 flex justify-center"><a href="/resume-maker" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-primary-solid)] px-5 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2">Open Resume Builder</a></div></Card>
      </Container>
    </Section>
  </MarketingShell>;
}
