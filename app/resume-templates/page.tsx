import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../json-ld";
import TemplateCatalog from "./template-catalog";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { tailoredResumes } from "@/lib/limits";
import { Breadcrumb, Card, Container, MarketingShell, Section } from "@/components/ui/primitives";
import { DirectoryMethodCard, RelatedWorkflow } from "@/components/marketing";

// /resume-templates — SEO landing for "resume templates" (high-volume keyword).
// Doubles as the templates gallery. RoleSharp uses a focused ATS-safe set rather
// than dozens of design variants — this page explains why and routes to the builder.
export const metadata: Metadata = {
  title: "Free ATS Resume Templates (2026)",
  description:
    "Use free ATS-friendly resume templates with clean layouts and standard headings. Build your resume and export a PDF free.",
  alternates: { canonical: "/resume-templates" },
  openGraph: {
    type: "website",
    title: "Free ATS Resume Templates — Clean & Hiring-Ready",
    description: "ATS-friendly resume templates that parse cleanly. Build and export a PDF free, no sign-up.",
    url: "/resume-templates",
    images: ["/opengraph-image"],
  },
};

const FAQS: [string, string][] = [
  ["What makes a resume template ATS-friendly?", "A single-column layout, standard section headings (Experience, Education, Skills), no text inside images or tables, and a clean sans-serif font. Fancy multi-column designs with sidebars often fail to parse in Applicant Tracking Systems. RoleSharp's templates enforce all of this by default."],
  ["Are these templates free?", `Yes. The templates are free to use in the manual resume maker and the AI builder. You can build and export a PDF on the free plan — ${tailoredResumes(env.freeMonthlyLimit)} a month, unlimited manual builds.`],
  ["Why fewer templates instead of dozens?", "RoleSharp keeps a focused set built around standard headings, readable text, and predictable reading order. Those structural choices reduce avoidable parsing risk, while the content you put in the template still determines whether the resume fits a real job."],
  ["Can I customize the template?", "Yes. In the builder you can adjust fonts, spacing, section order, and color accents while the layout stays ATS-safe. You're not locked into a fixed design."],
  ["What format do templates export to?", "PDF on all plans (small watermark on free). DOCX on Premium. The PDF is formatted to match the template you chose."],
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

const TEMPLATE_GUIDES = [
  {
    href: "/blog/resume-pdf-or-docx",
    title: "Resume PDF or DOCX? What to send in 2026",
    body: "Format choice still affects how cleanly a strong template reaches the ATS.",
  },
  {
    href: "/blog/ats-friendly-resume-2026",
    title: "How to build an ATS-friendly resume",
    body: "Choose a structure and length that keep the resume readable to both ATS software and recruiters.",
  },
  {
    href: "/blog/fix-old-resume-or-build-new",
    title: "Fix an old resume or build a new one?",
    body: "Know when a stronger template is enough and when the underlying content needs a full rebuild.",
  },
] as const;

export default function ResumeTemplatesPage() {
  return (
    <MarketingShell className="growth-page growth-catalog">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Resume Templates", item: `${env.siteUrl}/resume-templates` },
        ])}
      />
      <JsonLd data={FAQ_LD} />

      <header className="desk-tool-header border-b border-[var(--border)]">
        <Container className="py-8 md:py-12">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Resume Templates" }]} />
            <h1 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-bold! leading-tight! tracking-tight!">
              Choose a resume layout
            </h1>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl">
              Six focused starting styles for different careers and markets. Preview every design, switch without
              losing content, and export a text-based document with a predictable reading order.
            </p>
        </Container>
      </header>

      {/* Visual template gallery */}
      <Section asContainer={false} size="sm">
        <Container>
          <div className="mb-8 reveal-on-scroll">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Compare the six layouts
            </h2>
            <p className="max-w-2xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Filter by the kind of application you are making. Every option uses standard headings, a controlled reading order,
              and text-based export, while actual parsing still depends on the employer's software and configuration.
            </p>
          </div>
          <TemplateCatalog />
        </Container>
      </Section>

      <Section asContainer={false} size="sm" alt>
        <Container>
          <DirectoryMethodCard
            title="The catalog describes structure—not a guaranteed parsing or hiring outcome."
            description="Template claims stay limited to features RoleSharp controls. Actual parsing can vary by export, ATS configuration, and the content entered by the candidate."
            items={[
              { kind: "curated", detail: "Six layouts selected around readable hierarchy, standard headings, and predictable reading order." },
              { kind: "illustrative", detail: "Every preview uses fictional placeholder content and metrics." },
              { kind: "guidance", detail: "Category and 'best for' labels are navigation guidance, not employer endorsements." },
              { kind: "guidance", detail: "Use the real job posting and your own evidence before submitting any resume." },
            ]}
          />
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <div className="reveal-on-scroll">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              Frequently asked questions
            </h2>
            <div className="growth-questions">
              {FAQS.map(([q, a]) => (
                <details
                  key={q}
                  className="group"
                >
                  <summary className="flex items-center justify-between gap-4 py-4 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)] cursor-pointer list-none hover:text-[var(--color-primary)] transition-colors">
                    <span className="text-base">{q}</span>
                    <span aria-hidden="true" className="growth-question-mark" />
                  </summary>
                  <p className="max-w-prose pb-5 pr-6 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section asContainer={false} size="sm" alt>
        <Container>
          <div className="reveal-on-scroll">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              Template-related guides
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATE_GUIDES.map((guide) => (
                <Link key={guide.href} href={guide.href} className="group block h-full">
                  <Card variant="elevated" padding="md" className="h-full lift transition-colors hover:border-[var(--color-primary)]">
                    <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                      {guide.title}
                    </b>
                    <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                      {guide.body}
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <RelatedWorkflow
        eyebrow="Use the selected structure"
        title="Start with the layout, then replace every placeholder with real evidence."
        description="Open the manual maker to choose a design without inventing content, or use the AI builder when a real job description is available for reviewable tailoring."
        href="/resume-maker"
        cta="Build from a template"
        secondary={{ href: "/build", label: "Tailor to a real job" }}
      />
    </MarketingShell>
  );
}
