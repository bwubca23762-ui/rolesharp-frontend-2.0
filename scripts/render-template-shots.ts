/**
 * Render every resume template to a real PDF for marketing imagery.
 *
 * The landing page and /resume-templates currently show TemplateThumb, which is
 * an abstract illustration made of grey bars. Competitors show the actual
 * document, readable, which is why their pages look like products and ours
 * looks like a wireframe. These renders come from lib/pdf.tsx, the same code
 * that produces a user's real export, so the marketing imagery cannot drift
 * from what the product actually outputs.
 *
 * Watermark is off deliberately: this is our own asset production, not a free
 * tier export. Content is fictional and matches the personas already used in
 * components/marketing/TemplateStudio.
 *
 * Usage: npx tsx scripts/render-template-shots.ts [outDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderResumePdf } from "../lib/pdf";
import type { ResumeContent } from "../lib/types";

type Sample = { template: string; name: string; content: ResumeContent };

const engineer: ResumeContent = {
  headline: "Senior Software Engineer",
  contact: { email: "priya.shah@example.com", phone: "+91 98765 43210", location: "Bengaluru, India", linkedin: "linkedin.com/in/example", links: [] },
  summary:
    "Backend engineer with seven years on high-throughput payment systems. Owns services end to end, from schema design through on-call, and reduced settlement failures by 18% at the last two employers.",
  skills: ["TypeScript", "Go", "PostgreSQL", "Kafka", "AWS", "Terraform", "Redis", "gRPC"],
  experiences: [
    {
      title: "Senior Software Engineer",
      company: "Fictional Payments Ltd",
      period: "2022 - present",
      bullets: [
        "Led the billing-flow redesign for a B2B SaaS product, reducing failed renewals by 18%.",
        "Cut p99 settlement latency from 1.4s to 320ms by replacing a synchronous ledger write with an append-only queue.",
        "Introduced contract tests across four services, removing the weekly integration freeze.",
      ],
    },
    {
      title: "Software Engineer",
      company: "Example Systems",
      period: "2019 - 2022",
      bullets: [
        "Built the reconciliation pipeline processing 2.3M transactions daily.",
        "Migrated 40 endpoints off a shared monolith with no customer-visible downtime.",
        "Wrote the on-call runbook that cut mean time to recovery from 47 to 12 minutes.",
        "Mentored three junior engineers through their first production launches.",
      ],
    },
    {
      title: "Backend Developer",
      company: "Sample Analytics",
      period: "2017 - 2019",
      bullets: [
        "Shipped the event ingestion service still handling 40k messages per second.",
        "Replaced nightly batch reporting with streaming aggregates, cutting data lag from 18 hours to 90 seconds.",
      ],
    },
  ],
  education: [
    { degree: "B.Tech, Computer Science", school: "Example Institute of Technology", year: "2019", detail: "First class, department rank 4" },
  ],
  projects: [
    { name: "openledger", detail: "Open-source double-entry ledger library used by 40 teams, 1.2k stars." },
    { name: "pgqueue", detail: "Postgres-backed job queue with exactly-once delivery semantics." },
  ],
  certifications: ["AWS Solutions Architect, Associate", "Certified Kubernetes Application Developer"],
  languages: ["English", "Hindi", "Kannada"],
  achievements: [
    "Speaker, Fictional Payments Conference 2025, on idempotent settlement design.",
    "Internal engineering award for the settlement latency work, 2024.",
  ],
};

const analyst: ResumeContent = {
  headline: "Senior Financial Analyst",
  contact: { email: "jordan.reed@example.com", phone: "+1 212 555 0148", location: "New York, NY", linkedin: "linkedin.com/in/example", links: [] },
  summary:
    "Analyst covering industrials for a fictional asset manager. Builds the models that decide capital allocation and presents them to an investment committee every quarter.",
  skills: ["Financial modelling", "Valuation", "Python", "SQL", "Bloomberg", "Scenario analysis"],
  experiences: [
    {
      title: "Senior Financial Analyst",
      company: "Fictional Capital Partners",
      period: "2021 - present",
      bullets: [
        "Owns the industrials coverage model informing a $240M book.",
        "Rebuilt the quarterly forecast process, cutting close time from nine days to four.",
        "Presented three acquisition cases to the investment committee; two were funded.",
      ],
    },
    {
      title: "Financial Analyst",
      company: "Example Advisors",
      period: "2018 - 2021",
      bullets: [
        "Supported twelve diligence processes across manufacturing and logistics.",
        "Built the comparable-company database still used by the coverage team.",
        "Automated the monthly variance pack in Python, saving roughly 20 analyst hours a month.",
      ],
    },
    {
      title: "Investment Banking Analyst",
      company: "Sample Securities",
      period: "2016 - 2018",
      bullets: [
        "Supported four completed transactions with a combined value of $1.8B.",
        "Ran the model review process for the industrials desk.",
      ],
    },
  ],
  education: [
    { degree: "MBA, Finance", school: "Example Business School", year: "2018", detail: "Dean's list, investment club chair" },
    { degree: "BSc, Economics", school: "Example University", year: "2016", detail: "" },
  ],
  projects: [{ name: "Industrials coverage model", detail: "Scenario engine covering 40 listed names, rebuilt quarterly." }],
  certifications: ["CFA Level II Candidate", "Bloomberg Market Concepts"],
  languages: ["English", "Spanish"],
  achievements: [
    "Runner-up, Example Business School stock pitch competition, 2018.",
    "Published two internal notes on industrials capital cycles.",
  ],
};

const SAMPLES: Sample[] = [
  { template: "basic", name: "Priya Shah", content: engineer },
  { template: "modern", name: "Priya Shah", content: engineer },
  { template: "compact", name: "Priya Shah", content: engineer },
  { template: "minimal", name: "Jordan Reed", content: analyst },
  { template: "executive", name: "Jordan Reed", content: analyst },
  { template: "elegant", name: "Jordan Reed", content: analyst },
  { template: "technical", name: "Priya Shah", content: engineer },
];

async function main() {
  const outDir = process.argv[2] || ".design-scratch/templates";
  mkdirSync(outDir, { recursive: true });

  for (const sample of SAMPLES) {
    const buf = await renderResumePdf(sample.content, sample.name, { template: sample.template, watermark: false });
    const path = `${outDir}/${sample.template}.pdf`;
    writeFileSync(path, buf);
    console.log(`${sample.template.padEnd(10)} ${String(buf.length).padStart(7)} bytes  ${path}`);
  }
  console.log(`\n${SAMPLES.length} templates rendered to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
