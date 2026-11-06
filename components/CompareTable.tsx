import { env } from "@/lib/env";
import { formatPlanPrice, tailoredResumes } from "@/lib/limits";

// Provider identities, rather than header positions, select every value.
const COLS = [
  { key: "rolesharp", label: "RoleSharp" },
  { key: "aiapply", label: "AIApply" },
  { key: "kickresume", label: "Kickresume" },
  { key: "resumeio", label: "Resume.io" },
  { key: "teal", label: "Teal" },
  { key: "rezi", label: "Rezi" },
  { key: "novoresume", label: "Novoresume" },
  { key: "zety", label: "Zety" },
  { key: "chatgpt", label: "ChatGPT" },
] as const;
type Provider = typeof COLS[number]["key"];

const SOURCE_ROWS: [string, string[]][] = [
  [
    "Free plan",
    [
      `${tailoredResumes(env.freeMonthlyLimit)} every month, plus credits`,
      "Limited trial",
      "Free with free customization options",
      "Limited",
      "1 resume template",
      "Credit-limited",
      "1-page basic templates",
      "Build only, no export",
      "Free tier drafts; no file export",
    ],
  ],
  [
    "Free PDF download",
    [
      "Yes (small watermark)",
      "Mostly paywalled",
      "Free with free customization",
      "TXT only",
      "Yes",
      "Limited / watermarked",
      "Basic template only",
      "No",
      "No — chat text, not a document",
    ],
  ],
  [
    "Tailors to a specific company",
    [
      "Yes — company + role + country",
      "Generic JD-based",
      "Job title + company + full job ad",
      "No",
      "JD match, not company-specific",
      "JD match, not company-specific",
      "No",
      "No",
      "Only what you paste, no posting to verify",
    ],
  ],
  [
    "ATS score included free",
    [
      "Yes, every version",
      "Paid",
      "Free score; deeper analysis paid",
      "Paid",
      "Limited / paid match score",
      "Limited",
      "Content tips, not a score",
      "Paid",
      "No parser, no score",
    ],
  ],
  [
    "Premium price",
    [
      `${formatPlanPrice(env.priceMonthlyCents)} / ${env.daysMonthly} days — ${formatPlanPrice(env.priceYearlyCents)} / ${env.daysYearly} days; no auto-renewal`,
      "$29/mo + credits",
      "Variable — verify current pricing",
      "$24.95/mo",
      "$29/mo",
      "$29/mo — $129/yr",
      "$19.95/mo — $99.95/yr",
      "~$23.95/mo after trial",
      "~$20/mo for the paid chat tier",
    ],
  ],
  [
    "Student offer",
    [
      "6 months free",
      "None advertised",
      "Free via ISIC, ITIC, or UNiDAYS",
      "None advertised",
      "50% off",
      "Discount",
      "Discount",
      "None advertised",
      "Same tiers, no student offer",
    ],
  ],
  [
    "Best known for",
    [
      "Company-specific tailoring",
      "Auto-apply",
      "Template polish",
      "Editor maturity",
      "Job tracker",
      "ATS bullet writing",
      "Guided editor",
      "Template variety",
      "Free general writing",
    ],
  ],
];

// The source snapshot order is fixed independently from presentation order.
// Reordering or hiding headers can no longer shift one provider's claims to
// another. Fail loudly if a future snapshot leaves a provider without data.
const SNAPSHOT_KEYS: readonly Provider[] = ["rolesharp", "aiapply", "kickresume", "resumeio", "teal", "rezi", "novoresume", "zety", "chatgpt"];
const ROWS = SOURCE_ROWS.map(([feature, values]) => {
  if (values.length !== SNAPSHOT_KEYS.length) throw new Error(`Incomplete comparison snapshot: ${feature}`);
  const cells = Object.fromEntries(SNAPSHOT_KEYS.map((key, index) => [key, values[index]])) as Record<Provider, string>;
  return { feature, cells };
});

export default function CompareTable() {
  return (
    <div>
      <div className="grid gap-3 md:hidden" aria-label="RoleSharp comparison summary">
        {ROWS.map(({feature, cells}) => (
          <article
            key={`mobile-${feature}`}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]"
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              {feature}
            </p>
            <div className="mt-2 rounded-lg border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-3">
              <span className="text-xs font-bold text-[var(--color-primary)]">RoleSharp</span>
              <p className="mt-1 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{cells.rolesharp}</p>
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] dark:text-[var(--color-dark-text-muted)]">
                Compare the alternatives
              </summary>
              <dl className="mt-3 grid gap-2">
                {COLS.filter((provider) => provider.key !== "rolesharp").map((competitor) => (
                  <div className="grid grid-cols-[7rem_1fr] gap-3 border-t border-[var(--color-border)] pt-2 dark:border-[var(--color-dark-border)]" key={competitor.key}>
                    <dt className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{competitor.label}</dt>
                    <dd className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{cells[competitor.key]}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[760px] text-sm border-separate border-spacing-0">
        <caption className="sr-only">RoleSharp compared with AIApply, Kickresume, Resume.io, Teal, Rezi, Novoresume, Zety, and ChatGPT</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-[var(--color-border)] px-4 py-4 text-left font-bold text-[var(--color-text)] dark:border-[var(--color-dark-border)] dark:text-[var(--color-dark-text)]"
            >
              Feature
            </th>
            {COLS.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`border-b border-[var(--color-border)] px-4 py-4 text-left font-bold dark:border-[var(--color-dark-border)] ${
                  c.key === "rolesharp"
                    ? "rounded-t-xl border-x border-t border-x-[var(--color-primary)]/25 border-t-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({feature, cells}) => (
            <tr
              key={feature}
              className="group"
            >
              <th
                scope="row"
                className="border-b border-[var(--color-border)] px-4 py-4 text-left font-semibold text-[var(--color-text)] group-last:border-b-0 dark:border-[var(--color-dark-border)] dark:text-[var(--color-dark-text)]"
              >
                {feature}
              </th>
              {COLS.map((provider) => (
                <td
                  key={provider.key}
                  className={`border-b border-[var(--color-border)] px-4 py-4 align-top leading-relaxed group-last:border-b-0 dark:border-[var(--color-dark-border)] ${
                    provider.key === "rolesharp"
                      ? "border-x border-x-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 font-semibold text-[var(--color-text)] group-last:rounded-b-xl group-last:border-b group-last:border-b-[var(--color-primary)]/25 dark:text-[var(--color-dark-text)]"
                      : "text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"
                  }`}
                >
                  {cells[provider.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="mt-4 text-xs text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]">
        Snapshot from public provider pages. Kickresume details were recaptured on 2026-08-03; its pricing is intentionally shown as variable because captured offers conflict. Other provider rows retain their existing July 2026 review date. Verify current limits, eligibility, billed totals, and renewal terms before deciding.
      </p>
    </div>
  );
}
