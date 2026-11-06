import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import JsonLd from "../json-ld";
import { FaqSection } from "../seo-blocks";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { COVER_LETTER_STRUCTURES, SAMPLE_EVIDENCE } from "@/lib/cover-letter-structures";
import { GeneratedOutput } from "@/components/ui/primitives";
import { Breadcrumb, Button, Card, Container, MarketingShell, PageHeader, Section } from "@/components/ui/primitives";
import { SampleProvenance } from "@/components/marketing";
import { RelatedWorkflow } from "@/components/marketing";

// /cover-letter-templates — the gallery. Not six PDFs in different fonts: six
// argument shapes, every sample rendered live from the same evidence set by
// lib/cover-letter-structures.ts, so the page cannot drift away from what the
// product actually writes.
const DESCRIPTION =
  "Compare six free cover letter structures using the same candidate facts. Choose an approach for referrals, career changes, short letters and more.";

export const metadata: Metadata = {
  title: "Cover Letter Templates (Free, 2026)",
  description: DESCRIPTION,
  alternates: { canonical: "/cover-letter-templates" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Cover Letter Templates — Six Structures, One Set of Facts | RoleSharp",
    description: DESCRIPTION,
    url: "/cover-letter-templates",
  },
};

const FAQS: [string, string][] = [
  [
    "What is a cover letter template?",
    "Usually it means a document with a layout and some placeholder sentences. That is the least useful part. What decides whether a letter works is the order of the argument — what it leads with, what it proves next, and what it leaves out. These six templates are those orders, and each one shows the same candidate's evidence arranged that way.",
  ],
  [
    "Which cover letter template should I use?",
    "Direct, unless something else is true. Use Referral if someone inside the company actually suggested you apply, Career change if your last title does not match the one you want, Short if the box is small or the letter is optional, and Speculative if there is no posting at all.",
  ],
  [
    "How long should a cover letter be?",
    "Shorter than you think. The Short template here is four sentences and it still carries the one number that matters. A letter earns its length by adding evidence, not by adding warmth.",
  ],
  [
    "Do these templates come as a Word or PDF download?",
    "No, and that is deliberate. A downloaded file tempts you to keep the placeholder sentences, which are the part hiring managers have read a thousand times. Copy the structure, then write your own evidence into it, or let the generator do that from a resume you have already saved.",
  ],
  [
    "Should I write a cover letter at all in 2026?",
    "If the application asks for one, yes, and a bad one costs you more than none. If it is optional, a four-sentence letter that names one measurable result is worth writing and takes about five minutes.",
  ],
  [
    "Will the generator write in these structures?",
    "The generator writes from your saved resume and the job description, and it keeps the same rule these samples do: it arranges evidence you supplied and never invents a fact to fill a gap.",
  ],
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default function CoverLetterTemplatesPage() {
  return (
    <MarketingShell className="growth-page growth-letters">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Cover Letter Templates", item: `${env.siteUrl}/cover-letter-templates` },
        ])}
      />
      <JsonLd data={FAQ_LD} />

      <Section asContainer={false} className="growth-opening">
        <Container>
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cover Letter Templates" }]} />
          <PageHeader
            eyebrow="Cover letter templates"
            title="Six structures, one set of facts"
            description="See how six cover letters use the same experience to make different arguments for the role."
            className="mb-4"
          />
          <SampleProvenance
            status="fictional"
            detail="Priya Raman and Ledgerline are invented. Every letter below is rendered from the same evidence by the same code the product uses."
            className="mb-8"
          />
          <div className="flex flex-wrap gap-3">
            <Button as="a" href="/cover-letter-generator">Generate one from my resume</Button>
            <Button as="a" href="/cover-letter-examples" variant="outline">See examples by role</Button>
          </div>
          <nav className="growth-index" aria-label="Jump to a cover letter structure">
            {COVER_LETTER_STRUCTURES.map(({ slug, name }) => <a key={slug} href={`#${slug}`}>{name}</a>)}
          </nav>
        </Container>
      </Section>

      <Section asContainer={false}>
        <Container>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {COVER_LETTER_STRUCTURES.map((structure) => (
              <Card key={structure.slug} variant="outline" padding="lg" className="growth-letter">
                <h2 id={structure.slug} className="text-xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  {structure.name}
                </h2>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div>
                    <dt className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Leads with</dt>
                    <dd className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{structure.leadsWith}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Use it when</dt>
                    <dd className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{structure.useWhen}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Never</dt>
                    <dd className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{structure.neverDo}</dd>
                  </div>
                </dl>
                <GeneratedOutput
                  label="Structure sample"
                  text={structure.render(SAMPLE_EVIDENCE)}
                  copyDisabled
                />
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <RelatedWorkflow
        title="Write one of these from evidence you already have."
        description="If you have a resume saved in RoleSharp, the cover letter generator arranges its results against the job description — same rule as these samples, nothing invented to fill a gap."
        href="/cover-letter-generator"
        cta="Open the cover letter generator"
        secondary={{ href: "/resume-templates", label: "Resume templates" }}
      />

      <FaqSection className="growth-faq" visible heading="Cover letter templates — common questions" faqs={FAQS} headingClassName="text-2xl md:text-3xl" />
    </MarketingShell>
  );
}
