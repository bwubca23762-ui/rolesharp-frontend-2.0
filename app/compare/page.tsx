import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import { COMPETITORS } from "@/content/competitors";
import CompareTable from "@/components/CompareTable";
import { SubscriptionSavingsCalculator } from "@/components/marketing/SubscriptionSavingsCalculator";
import { Container, Section, MarketingShell, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Resume Builder Comparisons (2026)",
  description:
    "Compare RoleSharp with Kickresume, Teal, Rezi, Resume.io, Zety, Novoresume, and AIApply across pricing, free plans, and features.",
  alternates: { canonical: "/compare" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp vs Other Resume Builders — Honest Comparisons",
    description: "Dated public-source comparisons with volatile claims qualified instead of frozen as facts.",
    url: "/compare",
  },
};

export default function CompareIndexPage() {
  return (
    <MarketingShell className="reading-shell">
      <section className="reading-masthead">
        <Container className="relative z-10 py-10 md:py-14">
          <PageHeader
            title="Compare resume builders"
            description="See how RoleSharp and other resume builders differ in pricing, free allowances, and tools. Individual comparisons include their sources and review dates."
          />
          <nav aria-label="Comparison sections" className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
            <a href="#feature-comparison" className="reading-text-link">Compare features</a>
            <a href="#savings-calculator" className="reading-text-link">Estimate your cost</a>
            <a href="#individual-comparisons" className="reading-text-link">Read a comparison</a>
          </nav>
        </Container>
      </section>

      <Section size="sm">
        <section id="feature-comparison" aria-label="Feature comparison">
          <CompareTable />
        </section>
        <section id="savings-calculator" aria-label="Subscription savings calculator" className="mt-8">
          <SubscriptionSavingsCalculator />
        </section>

        <section id="individual-comparisons" aria-labelledby="individual-comparisons-title" className="mt-10 max-w-4xl">
          <h2 id="individual-comparisons-title" className="mb-4 text-2xl font-bold">Individual comparisons</h2>
          <ul className="reading-rows">
            {COMPETITORS.map((item) => (
              <li key={item.slug}>
                <a href={`/compare/${item.slug}`} className="reading-row">
                  <span>
                    <span className="reading-row-heading">RoleSharp vs {item.name}</span>
                    <span className="reading-row-caption">{item.intro}</span>
                  </span>
                  <span aria-hidden="true" className="reading-row-arrow">→</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
            <a href="/checker" className="reading-text-link">Check your resume</a>
            <a href="/build" className="reading-text-link">Open the AI builder</a>
          </div>
        </section>
      </Section>
    </MarketingShell>
  );
}
