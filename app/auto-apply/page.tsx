import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import ConnectionPanel from "@/app/email-connection/connection-panel";
import QueuePanel from "@/app/application-queue/queue-panel";
import FeatureAccessPanel from "@/components/FeatureAccessPanel";
import { env } from "@/lib/env";
import { MethodologyCallout, RelatedWorkflow } from "@/components/marketing";
import { Button, Container, MarketingShell, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Auto Apply for Verified Email Applications",
  description: "Prepare and send a tailored CV from a separately connected Gmail or Outlook account only when a job posting explicitly accepts email applications.",
  alternates: { canonical: "/auto-apply" },
  openGraph: {
    title: "RoleSharp Auto Apply — Email Applications Only",
    description: "Controlled application email with explainable matching, review, consent, daily caps, and truthful delivery-unverified receipts.",
    url: "/auto-apply",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "RoleSharp Auto Apply — Email Applications Only",
    description: "Controlled application email for posting-backed recipients, with review, consent, caps, and no ATS-form automation.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

const autoApplyFaqs = [
  ["Can it apply everywhere?", "No. It supports only explicit application-by-email instructions in the stored posting. ATS forms, job-board flows, screening questions, and ambiguous recipients stay manual."],
  ["Can RoleSharp read my mailbox?", "No. Gmail requests gmail.send plus basic identity. Microsoft requests delegated Mail.Send and User.Read only to confirm the connected account. No inbox-read or modify scopes are requested."],
  ["What does evidence confidence mean?", "It measures how much reliable profile and posting evidence supports the fit calculation. It is not a hiring, interview, or delivery probability."],
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${env.siteUrl}/auto-apply#app`,
      name: "RoleSharp Auto Apply",
      url: `${env.siteUrl}/auto-apply`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "Controlled CV application email for postings that explicitly accept email applications, with separate send-only mailbox consent.",
      featureList: [
        "Explainable fit and evidence confidence",
        "Gmail and Microsoft send-only delegated OAuth",
        "Review-each approval for immutable application packages",
        "Posting-backed recipient verification",
        "At-most-once application ledger and delivery-unverified receipts",
      ],
      isPartOf: { "@id": `${env.siteUrl}/#app` },
      publisher: { "@id": `${env.siteUrl}/#org` },
    },
    {
      "@type": "FAQPage",
      mainEntity: autoApplyFaqs.map(([question, answer]) => ({
        "@type": "Question", name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: env.siteUrl },
        { "@type": "ListItem", position: 2, name: "Auto Apply", item: `${env.siteUrl}/auto-apply` },
      ],
    },
  ],
};

export default function AutoApplyPage() {
  return <MarketingShell>
    <JsonLd data={structuredData} />
    <section className="relative border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
      <Container className="py-14 md:py-20">
        <PageHeader
          eyebrow="Auto Apply — email applications only"
          title="Controlled application email, never mass ATS submission"
          description="RoleSharp can prepare and send a CV only when the stored job posting explicitly tells candidates to apply by email and contains the recipient. It does not automate LinkedIn, Indeed, or ATS forms, guess recruiter addresses, read your inbox, or call an email an ATS submission."
          actions={
            <>
              <Button as="a" href="/campaign-settings">Set up campaign rules</Button>
              <Button as="a" href="/daily-matches" variant="outline">View Daily Matches</Button>
            </>
          }
        />
        <ol aria-label="How email applications work" className="grid list-none divide-y divide-[var(--border)] border-y border-[var(--border)] md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            ["Check the posting", "RoleSharp checks that the posting asks for applications by email and supplies the recipient."],
            ["Review the application", "Confirm the recipient, message, and resume together. Approval lasts 24 hours."],
            ["Check the receipt", "The receipt records whether Gmail or Outlook accepted the email. Delivery stays unverified."],
          ].map(([title, description], index) => (
            <li key={title} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 py-4 md:px-5 md:first:ps-0">
              <span aria-hidden="true" className="pt-0.5 font-mono text-sm tabular-nums text-[var(--muted-fg)]">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p className="font-semibold text-[var(--fg)]">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted-fg)]">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
    <Container className="space-y-14 py-12">
      <FeatureAccessPanel />
      <ConnectionPanel />
      <QueuePanel headingLevel="h2" showAttempts={false} />
      <MethodologyCallout
        eyebrow="Automation method and limits"
        title="Eligibility is posting-backed; outcomes remain deliberately conservative."
        description="A queue item can advance only when the stored posting explicitly accepts email applications, supplies the recipient, and passes consent, cap, cooldown, duplicate, and immutable-package checks."
        points={[
          "Fit and evidence confidence are not hiring probabilities",
          "Provider acceptance is recorded as delivery unverified",
          "Unknown outcomes cannot trigger an automatic retry",
          "ATS-only and ambiguous-recipient jobs remain manual",
        ]}
        href="/about#auto-apply-safety"
      />
      <section aria-labelledby="auto-apply-faq">
        <h2 id="auto-apply-faq" className="text-xl font-semibold">Auto Apply questions</h2>
        <div className="mt-4 divide-y divide-[var(--border)]">
          {autoApplyFaqs.map(([question, answer]) => (
            <details key={question} className="py-3">
              <summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline-2 focus-visible:outline-[var(--ring)]">{question}</summary>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted-fg)]">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </Container>
    <RelatedWorkflow
      title="Review the job and resume package before authorizing email."
      description="Daily Matches keeps the source posting and fit evidence visible. Campaign settings then define the consent mode, thresholds, daily cap, and expiry."
      href="/daily-matches"
      cta="Review Daily Matches"
      secondary={{ href: "/campaign-settings", label: "Set campaign controls" }}
    />
  </MarketingShell>;
}
