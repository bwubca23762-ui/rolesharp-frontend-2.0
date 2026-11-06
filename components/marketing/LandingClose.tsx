import { ChevronRight } from "@/app/icons";
import { Button, Container, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";
import { env } from "@/lib/env";
import { tailoredResumes } from "@/lib/limits";

export const landingFaqs: [string, string][] = [
  ["Which tool should I start with?", "Use Resume Fixer if you already have a file, the AI Builder if you have a specific job, or the Manual Maker if you are starting from scratch."],
  ["Can I try RoleSharp without creating an account?", "Yes. You can try the resume checks without an account. Saving work and using signed-in workspace features requires an account."],
  ["Does RoleSharp invent experience or metrics?", "No. Suggestions are intended to use the titles, dates, skills, and outcomes you provide. Review every proposed edit before using it."],
  ["Will it work for applications outside the United States?", "RoleSharp provides country-aware formatting guidance across 200+ countries and territories, with explanations you can review and override."],
  ["What does Auto Apply actually do?", "It supports controlled application-by-email only when a current posting explicitly publishes the recipient. It does not complete job-board or ATS forms or guess contact details."],
  ["What are the current plan limits?", `Free includes ${tailoredResumes(env.freeMonthlyLimit)} per rolling month, Premium includes ${env.premiumMonthlyLimit}, and eligible Student access includes ${env.studentMonthlyLimit}. Manual tools remain available outside those generation allowances.`],
];

/**
 * Act 6 of 7 — FAQ + live catalogue stats merged; Act 7 — close statement.
 * FAQ items unbox to hairline rules; the close drops the rounded navy slab
 * for a full-width ink canvas with the page's second permitted glow.
 */
export function LandingClose() {
  return (
    <>
      <Section asContainer={false} alt>
        <Container size="small">
          <SectionHeader eyebrow="Common questions" title="Know what the product does before you upload." align="center" />
          <div className="mt-9">
            {landingFaqs.map(([question, answer], index) => (
              <Reveal key={question} variant="fade" delay={index * 60}>
                <details className="group border-b border-[var(--hairline)] py-1">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] dark:text-[var(--color-dark-text)]">
                    {question}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-[var(--muted-fg)] transition-transform group-open:rotate-45 motion-reduce:transform-none" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="max-w-3xl pb-5 text-[15px] leading-7 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Act 7 — the close. Ink canvas, dimmer echo of the hero glow, one CTA. */}
      <section className="edt-glow relative overflow-hidden">
        <Container>
          <Reveal variant="rise">
            <div className="relative mx-auto max-w-3xl py-8 text-center md:py-12">
              <h2 className="text-[clamp(2.25rem,5vw,4rem)] font-extrabold! leading-[1.02]! tracking-[-0.04em]! text-[var(--fg)] text-balance">
                Stop sending generic resumes.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[var(--muted-fg)]">
                Upload what you have for a ranked review, or start a role-specific draft with the evidence you already earned.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Button as="a" href="/resume-fixer" size="lg" rightIcon={<ChevronRight size={17} />}>Check my resume free</Button>
                <Button as="a" href="/build" variant="outline" size="lg">Tailor for a job</Button>
              </div>
              {/* The single trust footnote on the page — everything else lives in Plans. */}
              <p className="mt-10 font-[family-name:var(--font-mono)] text-xs text-[var(--muted-fg)]">
                No card for Free — Premium is fixed-term and never auto-renews — Review every suggested edit
              </p>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
