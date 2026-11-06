import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../json-ld";
import BuildLauncher from "@/components/BuildLauncher";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";

import { Target } from "../icons";
import { Badge, Breadcrumb, Button, Card, Container, Eyebrow, MarketingShell, Section } from "@/components/ui/primitives";

// /resume-tailoring — intent landing for "tailor resume to job / company".
// This is RoleSharp's core differentiator (company + role + country tailoring),
// so the page goes deep: what tailoring is, why generic resumes fail, how the
// engine does it, manual-vs-RoleSharp comparison, and FAQ.
export const metadata: Metadata = {
  title: "Tailor Your Resume to Any Job & Company with AI",
  description:
    "Tailor your resume to a specific company, role, and job description in minutes. AI keyword matching, an instant ATS score, and honest rewrites — free to start.",
  alternates: { canonical: "/resume-tailoring" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Resume Tailoring — Match Any Company, Role & Job Description",
    description:
      "Stop sending one generic resume everywhere. Tailor it to the exact company and role with AI keyword matching and an instant ATS score.",
    url: "/resume-tailoring",
  },
};




// Illustrative example of what the tailor produces (design demo, not live data)
const EXAMPLE_KEYWORDS: { t: string; m: boolean }[] = [
  { t: "Design systems", m: true },
  { t: "B2B SaaS", m: true },
  { t: "Prototyping in Figma", m: true },
  { t: "Cross-functional partnership", m: true },
  { t: "Quant research familiarity", m: false },
  { t: "Accessibility WCAG 2.2", m: false },
  { t: "Onboarding flows", m: true },
  { t: "Design ops experience", m: false },
];

const EXAMPLE_REWRITES: { was: string; now: string }[] = [
  { was: "Worked on onboarding.", now: "Redesigned onboarding, lifting activation 24% within one quarter." },
  { was: "Contributed to design system.", now: "Owned design system rollout across four surfaces used by 12k weekly users." },
];

export default function ResumeTailoringPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Resume Tailoring", item: `${env.siteUrl}/resume-tailoring` },
        ])}
      />

      {/* Page header — redesign PageHero style */}
      <header className="border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)]/60 dark:bg-[var(--color-dark-surface)]/60 py-12 md:py-16 text-center">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Resume Tailoring" }]} />
            <div className="flex justify-center gap-3 mb-4">
              <Badge variant="success">Free to start</Badge>
            </div>
            <div className="flex justify-center">
              <Eyebrow>Tailor to a job</Eyebrow>
            </div>
            <h1 className="font-display text-3xl md:text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Tailor Your Resume to the Exact Job — and the Exact Company
            </h1>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              One generic resume sent everywhere is the single most common reason good candidates
              never hear back. RoleSharp rewrites your real experience for one specific opening —
              company, role, country, and job description — with an instant ATS score, in minutes.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button as="a" href="/build" size="lg">Tailor my resume — free</Button>
              <Button as="a" href="/checker" variant="outline" size="lg">Check my current resume</Button>
            </div>
          </div>
        </Container>
      </header>

      {/* Entry point: /build owns the work and reads prefill from the fragment. */}
      <Section asContainer={false} size="sm" id="launcher">
        <Container size="small">
          <BuildLauncher
            mode="tailor"
            heading="Tailor to a company and role"
            description="Tailoring works from the actual target. Name the company and role and the builder opens already pointed at them — add the job description there for keyword-level matching."
            actionLabel="Open the builder, targeted"
          />
        </Container>
      </Section>

      {/* What the tailor produces — illustrative demo ported from redesign */}
      <Section asContainer={false} size="sm" alt>
        <Container>
          <div className="mb-8 text-center reveal-on-scroll">
            <div className="flex justify-center">
              <Eyebrow>What you get</Eyebrow>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              The posting&apos;s words, matched against your real evidence.
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Example output for a Senior Product Designer posting — your results use your own resume and JD.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <Card padding="lg" className="reveal-on-scroll lift">
              <div className="flex items-center justify-between">
                <Eyebrow>Requirements found</Eyebrow>
                <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  matched vs missing
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLE_KEYWORDS.map((k) => (
                  <Badge
                    key={k.t}
                    variant={k.m ? "primary" : "outline"}
                    className={k.m ? "" : "border-dashed"}
                  >
                    {k.t}
                  </Badge>
                ))}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] p-4">
                <Target size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden />
                <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] m-0">
                  Missing evidence for a requirement? RoleSharp flags the gap
                  instead of inventing facts.
                </p>
              </div>
            </Card>

            <Card padding="lg" className="reveal-on-scroll lift">
              <Eyebrow>Bullet rewrites</Eyebrow>
              <div className="mt-2 space-y-4">
                {EXAMPLE_REWRITES.map((b, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] p-3 text-xs">
                      <div className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Was</div>
                      <div className="mt-1 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{b.was}</div>
                    </div>
                    <div className="rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-3 text-xs">
                      <div className="font-semibold text-[var(--color-primary)]">Tailored</div>
                      <div className="mt-1 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{b.now}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button as="a" href="/build" size="sm">
                  Try it on your resume →
                </Button>
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card padding="lg" className="reveal-on-scroll">
            <Eyebrow>Keep exploring</Eyebrow>
            <p className="mt-1 text-[var(--color-text)] dark:text-[var(--color-dark-text)] leading-relaxed">
              Score your current resume with the{" "}
              <Link href="/checker" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">ATS checker</Link>,
              repair an old file with the{" "}
              <Link href="/resume-fixer" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">resume fixer</Link>,
              browse tailored{" "}
              <Link href="/companies" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">examples by company</Link>{" "}
              or{" "}
              <Link href="/roles" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">by role</Link>,
              adapt for another market with the{" "}
              <Link href="/resume-translator" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">country adapter</Link>,
              or read the{" "}
              <Link href="/blog/tailor-resume-to-job-description" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">manual tailoring guide</Link>.
            </p>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
