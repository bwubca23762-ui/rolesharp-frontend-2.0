import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../json-ld";
import ResumePreview from "../resume-preview";
import { FaqSection } from "../seo-blocks";
import { Check, Globe, Shield, Target } from "../icons";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { tailoredResumes } from "@/lib/limits";
import { Container, Section, Card, Button, Eyebrow, MarketingShell } from "@/components/ui/primitives";

// /resume-builder — SEO landing for "resume builder" (high-volume keyword).
// Routes to /build (the AI builder) and /resume-maker (manual) — both real tools.
export const metadata: Metadata = {
  title: "Free AI Resume Builder for Any Job (2026)",
  description:
    "Build an ATS-friendly resume tailored to any company, country, role, and job description. Get an ATS score and export a clean PDF.",
  alternates: { canonical: "/resume-builder" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Free AI Resume Builder — Tailored to Any Company & Role",
    description: "Build an ATS-optimized resume free. Tailor to any company, country, and role. Instant ATS score, PDF export.",
    url: "/resume-builder",
  },
};

const FAQS: [string, string][] = [
  ["Is the resume builder really free?", `Yes. You can build and export a resume on the free plan — ${tailoredResumes(env.freeMonthlyLimit)} a month with an ATS score and PDF download, no card required. The manual maker is unlimited free.`],
  ["What makes a resume ATS-friendly?", "A single-column layout, standard section headings (Experience, Education, Skills), role-specific keywords that match the job description, and no text hidden in images or tables. RoleSharp enforces all of this automatically."],
  ["Can I tailor the resume to a specific company?", "Yes — that's the core feature. Enter the company, role, and country, paste the job description, and the AI rewrites your resume to match that exact opening."],
  ["What formats can I export?", "PDF on all plans (small watermark on free). DOCX on Premium. Both stay saved in your dashboard so you can edit and re-export later."],
  ["Do I need an account to start?", "No. The manual resume maker and old-resume fixer work without any sign-up. You only need an account to save AI-tailored resumes or use the AI builder."],
  ["Can I build a resume from a job description?", "Yes. Paste the job description with the company and role. RoleSharp extracts the important requirements, matches them to experience you actually provide, and tailors the summary, skills, and bullets without inventing qualifications."],
];

export default function ResumeBuilderPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Resume Builder", item: `${env.siteUrl}/resume-builder` },
        ])}
      />

      <section className="relative isolate overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-surface)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-bg)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_28%,rgba(79,70,229,0.16),transparent_28rem),linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:auto,48px_48px,48px_48px] dark:opacity-70" />
        <Container className="py-12 md:py-16 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
            <div className="max-w-2xl">
              <nav aria-label="Breadcrumb" className="mb-5 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                <Link href="/" className="hover:text-[var(--color-primary)]">Home</Link>
                <span aria-hidden="true"> / </span>
                <span>Resume Builder</span>
              </nav>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Eyebrow>Free AI Resume Builder</Eyebrow>
                <span className="rounded-full border border-emerald-300/50 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  No card required
                </span>
              </div>
              <h1 className="text-4xl font-extrabold leading-[1.06] tracking-[-0.045em] text-[var(--color-text)] dark:text-[var(--color-dark-text)] sm:text-5xl lg:text-[3.45rem]">
                Build a resume for the job you actually want.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Add the company, role, country, and real job description. RoleSharp turns your own evidence into an ATS-ready resume, shows the gaps, and exports a clean PDF.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button as="a" href="/build" size="lg">Build with AI — free</Button>
                <Button as="a" href="/resume-fixer" variant="outline" size="lg">Check my current resume</Button>
              </div>
              <ul className="mt-7 grid gap-3 text-sm font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)] sm:grid-cols-3" aria-label="Builder benefits">
                <li className="flex items-center gap-2"><Check size={17} className="shrink-0 text-emerald-500" /> 3 free builds monthly</li>
                <li className="flex items-center gap-2"><Globe size={17} className="shrink-0 text-[var(--color-primary)]" /> 200+ markets</li>
                <li className="flex items-center gap-2"><Shield size={17} className="shrink-0 text-[var(--color-primary)]" /> No invented facts</li>
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-[590px]" aria-label="Example resume tailored for a product design role in Germany">
              <div aria-hidden className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-[var(--color-primary)]/20 via-transparent to-cyan-400/15 blur-2xl" />
              <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-[var(--shadow-xl)] backdrop-blur dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]/95 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3 text-xs dark:border-[var(--color-dark-border)]">
                  <span className="font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Tailored application preview</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ready to review</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(116px,0.8fr)] gap-3 sm:gap-4">
                  <ResumePreview />
                  <div className="grid content-start gap-3">
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]">
                      <Target size={17} className="text-[var(--color-primary)]" />
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.13em] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Application target</p>
                      <p className="mt-1 text-sm font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Product Designer</p>
                      <p className="mt-1 text-xs leading-snug text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Ledgerline — Berlin, Germany</p>
                    </div>
                    <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--color-primary)]">ATS readiness</p>
                      <div className="mt-1 flex items-end gap-1"><strong className="text-3xl leading-none text-[var(--color-text)] dark:text-[var(--color-dark-text)]">82</strong><span className="text-xs text-[var(--color-text-muted)]">/100</span></div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)] dark:bg-[var(--color-dark-border)]"><span className="block h-full w-[82%] rounded-full bg-gradient-to-r from-[var(--color-primary)] to-cyan-500" /></div>
                      <p className="mt-2 text-xs leading-snug text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Keywords matched. Two evidence edits remain.</p>
                    </div>
                    <div className="rounded-xl border border-emerald-300/40 bg-emerald-50 p-3 text-xs leading-snug text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-300">
                      <strong>Market-aware:</strong> local format guidance stays separate from your verified experience.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="mb-4">
            <h2 className="text-lg md:text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Choose your starting point
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card variant="elevated" padding="md">
              <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">AI Resume Builder</b>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-4">
                Paste the company name and job description. The AI rewrites your resume for that exact role — keywords, bullets, and summary all matched to the opening.
              </p>
              <Button as="a" href="/build">Start with AI</Button>
              <p className="mt-3 text-sm">
                <Link href="/build/help" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                  See how the AI builder works
                </Link>
              </p>
            </Card>
            <Card variant="elevated" padding="md">
              <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">Manual Resume Maker</b>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-4">
                Type it yourself with structured fields, live preview, and an ATS-safe layout. Zero AI — you write every word, the tool keeps the structure clean.
              </p>
              <Button as="a" href="/resume-maker" variant="outline">Open maker</Button>
            </Card>
            <Card variant="elevated" padding="md">
              <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">Old Resume Fixer</b>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-4">
                Already have a resume? Upload it and get an ATS score, missing keywords, and weak-bullet fixes before you rebuild anything.
              </p>
              <Button as="a" href="/resume-fixer" variant="outline">Fix my resume</Button>
            </Card>
          </div>
        </Container>
      </Section>

      

      <FaqSection heading="Frequently asked questions" faqs={FAQS} headingClassName="text-lg md:text-xl" />

      
    </MarketingShell>
  );
}
