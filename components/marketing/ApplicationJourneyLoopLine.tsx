import Link from "next/link";
import { Container } from "@/components/ui/primitives";

/**
 * The Check → Tailor → Apply → Track loop, stated in one line.
 *
 * This replaces the four-panel interactive demo (ApplicationJourney): the
 * owner read its fictional ATS-score widgets as filler boxes between the real
 * content. The loop itself is still a claim worth making — it just no longer
 * occupies a screen of simulated product. Each stage links to its tool so the
 * line is actionable, not decorative. Keeps the #application-journey anchor
 * the nav's featured-workflow entry points at.
 */
const STAGES = [
  { label: "Check", href: "/checker" },
  { label: "Tailor", href: "/build" },
  { label: "Apply", href: "/auto-apply" },
  { label: "Track", href: "/tracker" },
];

export function ApplicationJourneyLoopLine() {
  return (
    <section id="application-journey" className="scroll-mt-20 border-y border-[var(--hairline)] py-6">
      <Container size="large">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--muted-fg)]">
          <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em]">
            The loop
          </span>
          <span aria-hidden="true">—</span>
          <span className="text-lg text-[var(--fg)]">
            {STAGES.map((stage, index) => (
              <span key={stage.href}>
                {/* decoration-[var(--border)] not --hairline: the hairline
                    mix is 1.35:1 on white, under the 3:1 WCAG 1.4.11 asks
                    for meaningful non-text marks (audit #55/#57). */}
                {index > 0 && <span className="mx-2 text-[var(--muted-fg)]" aria-hidden="true">→</span>}
                <Link
                  href={stage.href}
                  className="font-semibold underline decoration-[var(--border)] underline-offset-4 transition-colors hover:text-[var(--color-primary)] hover:decoration-[var(--color-primary)]"
                >
                  {stage.label}
                </Link>
              </span>
            ))}
          </span>
          <span aria-hidden="true">—</span>
          <span className="text-sm">evidence and safety boundaries stay connected end to end.</span>
        </p>
      </Container>
    </section>
  );
}
