import type { Metadata } from "next";
import JsonLd from "../json-ld";
import { FaqSection } from "../seo-blocks";
import { breadcrumbLd } from "@/lib/seo";
import { PROMPT_FAQS, PROMPT_STRATEGIES } from "@/lib/aeo-content";
import { Target, Shield, Sparkles, FileText, MessageSquare, Linkedin } from "../icons";
import { Breadcrumb, Button, Card, Container, Eyebrow, MarketingShell, Section } from "@/components/ui/primitives";
import CopyPromptButton from "@/components/prompts/CopyPromptButton";

export const metadata: Metadata = {
  title: "AI Resume Prompts and ATS Strategies",
  description:
    "Copy practical AI prompts and ATS strategies to tailor your resume, strengthen weak bullets, and send better applications.",
  alternates: { canonical: "/prompts" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "AI Resume Prompts & Strategies — Beat ATS, Win Interviews",
    description: "The exact AI prompts and strategies that turn generic resumes into interview-winning applications.",
    url: "/prompts",
  },
};

const STRATEGY_ICONS = [Target, Shield, Sparkles, FileText, MessageSquare, Linkedin];

export default function PromptsPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: "/" },
          { name: "AI Prompts & Strategies", item: "/prompts" },
        ])}
      />

      <Section asContainer={false} className="!py-0 relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "AI Prompts & Strategies" }]} />
          <Eyebrow>AI Prompts</Eyebrow>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
            The AI prompts behind every RoleSharp resume.
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
            These are the exact strategies and prompts RoleSharp uses to transform generic resumes into interview-winning applications. Copy them, adapt them, use them anywhere.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button as="a" href="/build" size="lg">Try AI builder — free</Button>
            <Button as="a" href="/checker" variant="outline" size="lg">Check your resume first</Button>
          </div>
        </Container>
      </Section>

      <Section asContainer={false} size="sm" alt>
        <Container>
          <div className="grid gap-6">
            {PROMPT_STRATEGIES.map((strategy, i) => {
              const Icon = STRATEGY_ICONS[i];
              return (
                <Card key={strategy.title} variant="elevated" padding="lg">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] text-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                        {strategy.title}
                      </h2>
                      <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                        {strategy.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-3">
                        How it works
                      </h3>
                      <ol className="list-decimal pl-5 space-y-2 text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)] leading-relaxed">
                        {strategy.steps.map((step) => <li key={step}>{step}</li>)}
                      </ol>
                    </div>

                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]">
                          The prompt
                        </h3>
                        <CopyPromptButton prompt={strategy.prompt} title={strategy.title} />
                      </div>
                      <div className="bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] rounded-[var(--radius-lg)] p-5 text-sm leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)] font-mono">
                        {strategy.prompt}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Container>
      </Section>

      <FaqSection heading="Common questions about these prompts" faqs={PROMPT_FAQS} />

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card variant="gradient" padding="lg" className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to run these prompts automatically?
            </h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto leading-relaxed">
              RoleSharp applies all 6 strategies in about 8 seconds. You paste the job, we tailor the resume.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button as="a" href="/resume-fixer" variant="primaryInverse" size="lg">
                Fix my resume — free
              </Button>
              <Button as="a" href="/build" variant="outlineInverse" size="lg">
                Build a tailored resume
              </Button>
            </div>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
