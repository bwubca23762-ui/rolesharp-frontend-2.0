import { Check, ChevronRight, Coins, Copy, Users } from "@/app/icons";
import { Reveal, RuleReveal } from "@/components/motion";
import { Button, Container } from "@/components/ui/primitives";
import { env } from "@/lib/env";

/**
 * The referral act (owner ask: the landing page needs its own referral
 * section, not just the offer-rail fallback). Ink-canvas band between Plans
 * and the FAQ. Every reward number interpolates from lib/env — the
 * walkSurfaces test bans literal referral caps sitewide. The invite panel is
 * a markup-built product mock labelled as sample, same honesty law as the
 * hero chips. Unboxed per the anti-box law: the three steps are
 * hairline-separated editorial rows; only the product mock keeps a frame.
 */
export function ReferralAct() {
  const steps = [
    {
      icon: Users,
      title: "Share your invite link",
      body: "Your personal link lives in Settings → Credits. It carries your invite code through signup — even when your friend signs up with Google.",
    },
    {
      icon: Check,
      title: "They build their first resume",
      body: "The reward triggers on a real event: a verified email plus a first generated resume. A signup alone never pays out.",
    },
    {
      icon: Coins,
      title: `You earn ${env.referralCreditReward} credit`,
      body: `Credit lands once per referred friend, up to ${env.referralMonthlyCap} per rolling ${env.daysMonthly} days. Credits raise your resume-generation allowance on the Free plan.`,
    },
  ];

  return (
    <section id="referral" className="scroll-mt-20 border-t border-[var(--hairline)] py-8 md:py-12">
      <Container size="large">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-8">
          <div>
            <Reveal variant="rise">
              <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--muted-fg)]">
                Referral program
              </p>
              <h2 className="mt-3 text-[clamp(1.85rem,3.4vw,3rem)] font-extrabold! leading-[1.04]! tracking-[-0.02em]! text-[var(--fg)] text-balance">
                Invite a friend. Earn credits when they build.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted-fg)]">
                Every account gets a personal invite link. When someone you invite builds their
                first resume, RoleSharp adds {env.referralCreditReward} resume credit to your
                account — payment for real usage, never for a signup alone.
              </p>
            </Reveal>

            <details className="mt-4 border-y border-[var(--hairline)]">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--fg)]">How referral credits work</summary>
            <RuleReveal className="mt-2" />
            <div>
              {steps.map((step, index) => (
                <Reveal key={step.title} variant="rise" delay={index * 80}>
                  <article className="flex items-start gap-5 border-b border-[var(--hairline)] py-6 first:pt-5 last:border-b-0">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_16%,transparent)] text-[var(--primary)]">
                      <step.icon size={20} />
                    </span>
                    <span>
                      <h3 className="text-lg font-bold leading-6 text-[var(--fg)]">{step.title}</h3>
                      <p className="mt-1.5 max-w-lg text-[15px] leading-7 text-[var(--muted-fg)]">{step.body}</p>
                    </span>
                  </article>
                </Reveal>
              ))}
            </div>
            </details>

            <Reveal variant="rise" delay={260}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button as="a" href="/login" size="lg" rightIcon={<ChevronRight size={17} />}>
                  Get your invite link
                </Button>
                <Button as="a" href="/affiliate" variant="outline" size="lg">
                  Read the program rules
                </Button>
              </div>
            </Reveal>
          </div>

          {/* Product mock: the invite panel exactly as it appears in
              Settings → Credits, sample-labelled like every other number on
              this page. */}
          <Reveal variant="rise" delay={140}>
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--fg)]">Preview referral credits</summary>
            <figure
              aria-label="Sample invite panel showing a personal invite link and earned referral credits"
              className="rs-referral-panel mx-auto w-full max-w-md"
            >
              <figcaption className="flex items-center justify-between gap-3">
                <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--muted-fg)]">
                  Your invite panel — sample
                </span>
                <Copy size={15} aria-hidden className="text-[var(--muted-fg)]" />
              </figcaption>

              <div className="rs-referral-link mt-5">
                <span className="truncate">rolesharp.com/login?invite=KX4T-9M2</span>
                <span className="rs-referral-copy">Copy</span>
              </div>

              <div className="mt-5 space-y-2.5">
                {[
                  "Friend #1 — first resume built",
                  "Friend #2 — first resume built",
                ].map((label) => (
                  <div key={label} className="rs-referral-row">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" aria-hidden="true" />
                    <span className="min-w-0 truncate text-sm text-[var(--fg)]">{label}</span>
                    <span className="ml-auto font-[family-name:var(--font-mono)] text-xs font-semibold text-[var(--success)] tabular-nums">
                      +{env.referralCreditReward} credit
                    </span>
                  </div>
                ))}
                <div className="rs-referral-row">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--border)]" aria-hidden="true" />
                  <span className="min-w-0 truncate text-sm text-[var(--muted-fg)]">Rolling cap</span>
                  <span className="ml-auto font-[family-name:var(--font-mono)] text-xs text-[var(--muted-fg)] tabular-nums">
                    {env.referralMonthlyCap} per {env.daysMonthly} days
                  </span>
                </div>
              </div>

              <p className="mt-5 border-t border-[var(--hairline)] pt-4 text-xs leading-5 text-[var(--muted-fg)]">
                Credits are granted once per referred user after their email is verified and their
                first resume is generated. Check your balance in Settings → Credits.
              </p>
            </figure>
            </details>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
