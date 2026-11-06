import type { Metadata } from "next";
import SalaryEstimatorClient from "./salary-estimator-client";
import { salaryCountries } from "@/lib/salary-data";
import { candidatesPromise } from "@/lib/salary-pages";
import { Button, Card, ToolShell } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Salary Estimator — Real Ranges by Role & Country",
  description:
    "See real salary ranges for any role, computed from thousands of live job postings with published pay. Free, no account needed.",
  alternates: { canonical: "/salaries" },
  keywords: [
    "salary estimator", "salary by role", "salary by country", "average salary",
    "how much does a data analyst make", "salary range calculator", "pay scale",
  ],
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Salary Estimator — Real Ranges by Role & Country | RoleSharp",
    description: "Real salary ranges from live job postings. Pick a role and country, see the 25th–75th percentile bands.",
    url: "/salaries",
  },
};

const FAQS: [string, string][] = [
  ["Where does the salary data come from?", "From live job postings in our index that publish a salary — thousands across dozens of countries. We compute the 25th, 50th (median), and 75th percentile of the posted range midpoints for the role you pick."],
  ["Why do some roles show no data?", "We only state ranges when at least eight current postings publish salaries for that role and country. Rather than inventing a number, we say there isn't enough data yet."],
  ["Is this the same as an offer prediction?", "No. These are posted ranges from real listings — what employers are advertising, not what any individual will be offered."],
];

export default async function SalariesPage() {
  const [countryResult, candidateResult] = await Promise.allSettled([
    salaryCountries(),
    candidatesPromise(150),
  ]);
  const countries = countryResult.status === "fulfilled" ? countryResult.value : [];
  const dataUnavailable = countryResult.status === "rejected";
  if (countryResult.status === "rejected" || candidateResult.status === "rejected") {
    console.error("[salary:page] salary data query failed", {
      countryList: countryResult.status === "rejected",
      roleCandidates: candidateResult.status === "rejected",
    });
  }
  const candidates = candidateResult.status === "fulfilled" ? candidateResult.value.slice(0, 24) : [];

  return (
    <ToolShell
      eyebrow="Salary Estimator · 72 Markets"
      title="What does this role actually pay?"
      subtitle="Real salary ranges computed from live job postings with published pay — not estimates. Pick a role and country to inspect 25th, median, and 75th percentile bands."
      workspaceSize="large"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map(([name, text]) => ({
              "@type": "Question",
              name,
              acceptedAnswer: { "@type": "Answer", text },
            })),
          }),
        }}
      />

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <SalaryEstimatorClient countries={countries} dataUnavailable={dataUnavailable} />
        </div>

        <Card className="lg:col-span-5 lg:sticky lg:top-24">
          <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
            Salaries by role &amp; market
          </span>
          <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">
            Popular role × country guides
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">
            Click any role and market below to inspect the full percentile breakdown, top employers, and cross-market benchmarks.
          </p>

          {candidates.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {candidates.map((candidate) => (
                <li key={`${candidate.roleSlug}-${candidate.countryCode}`}>
                  <a
                    className="inline-block rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--fg)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    href={`/salaries/${candidate.roleSlug}/${candidate.countryCode.toLowerCase()}`}
                  >
                    {candidate.roleTitle} · {candidate.countryCode}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--muted-fg)]">Select any role and market on the left to query live postings.</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
            <Button as="a" href="/salary-negotiation-script" variant="outline" size="sm">
              💬 Salary Negotiation Script →
            </Button>
            <Button as="a" href="/jobs" variant="outline" size="sm">
              🔍 Browse Live Jobs →
            </Button>
            <Button as="a" href="/build" variant="ghost" size="sm">
              ✨ Tailor Resume
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-8 border-t border-[var(--hairline)] pt-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">How the numbers work</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {FAQS.map(([question, answer]) => (
            <div key={question} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-sm font-bold text-[var(--fg)]">{question}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-[var(--muted-fg)]">{answer}</p>
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}
