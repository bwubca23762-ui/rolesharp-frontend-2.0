import { ToolShell } from "@/components/ui/primitives";
import MicroGeneratorTool, { type MicroTool } from "./MicroGeneratorTool";
import JsonLd from "@/app/json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";

export type MicroGeneratorPageProps = {
  tool: MicroTool;
  eyebrow: string;
  title: string;
  intro: string;
  cta: string;
  faqs: [string, string][];
  /** Retired upsell prop; accepted so call sites do not break. */
  premiumPerks?: unknown;
};

const TOOL_META: Record<MicroTool, { path: string; description: string }> = {
  summary: { path: "/resume-summary-generator", description: "Generate a professional resume summary from your experience, target role, and skills." },
  bullets: { path: "/resume-bullet-points-generator", description: "Turn plain work notes into strong, specific resume bullet points." },
  experience: { path: "/work-experience-generator", description: "Write work-experience entries from your real role, company, and achievements." },
  career: { path: "/career-summary-generator", description: "Summarize a career's arc and strengths for a resume or LinkedIn." },
  resignation: { path: "/resignation-letter-generator", description: "Draft a clean, professional resignation letter with notice period intact." },
  thankyou: { path: "/thank-you-note-generator", description: "Write a specific, honest post-interview thank-you note." },
  negotiation: { path: "/salary-negotiation-script", description: "Draft a direct salary-negotiation email from your offer and target." },
  onboarding: { path: "/30-60-90-day-plan-generator", description: "Generate a 30-60-90 day plan from your role and what you were hired to achieve." },
  reference: { path: "/reference-prep-generator", description: "Generate a prep one-pager for your job reference before the call." },
};

export default function MicroGeneratorPage({ tool, eyebrow, title, intro, cta, faqs }: MicroGeneratorPageProps) {
  const meta = TOOL_META[tool];
  return (
    <ToolShell eyebrow={eyebrow} title={title} subtitle={intro} workspaceSize="large">
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: title, item: meta.path }])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: `${title} — RoleSharp`,
          url: `${env.siteUrl}${meta.path}`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires JavaScript",
          description: `${meta.description} Free, no account required.`,
          offers: { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }}
      />
      <MicroGeneratorTool tool={tool} cta={cta} />
      {faqs.length > 0 && (
        <section aria-labelledby="mg-faq" className="mt-10 grid gap-4 border-t border-[var(--hairline)] pt-6 lg:grid-cols-[minmax(12rem,.65fr)_minmax(0,1.65fr)] lg:gap-12">
          <h2 id="mg-faq" className="text-xl font-semibold tracking-tight">Common questions</h2>
          <div className="divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
            {faqs.map(([q, a]) => (
              <details key={q} className="group">
                <summary className="min-h-12 cursor-pointer content-center py-2.5 text-sm font-semibold leading-6">{q}</summary>
                <p className="pb-4 text-sm leading-6 text-[var(--muted-fg)]">{a}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </ToolShell>
  );
}
