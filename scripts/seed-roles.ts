import { q, hasDb } from "../lib/db";
import { embed } from "../lib/llm";

function vec(e: number[] | null) {
  return e ? `[${e.join(",")}]` : null;
}

// Seed a small starter set of role norms. In production this is replaced by a
// bulk O*NET + ESCO + India NCO import (~10K rows, ~100MB). Run: npm run seed:roles
const ROLES = [
  { slug: "software-engineer", title: "Software Engineer", sector: "IT", seniority: "mid",
    required_skills: ["JavaScript", "Data Structures", "System Design", "Git", "Testing"],
    typical_bullets: ["Reduced API latency by 40% via caching", "Shipped features used by 1M+ users"] },
  { slug: "data-analyst", title: "Data Analyst", sector: "IT", seniority: "mid",
    required_skills: ["SQL", "Excel", "Python", "Tableau", "Statistics"],
    typical_bullets: ["Built dashboards cutting reporting time 60%", "Drove $200K savings via churn analysis"] },
  { slug: "registered-nurse", title: "Registered Nurse", sector: "Healthcare", seniority: "mid",
    required_skills: ["Patient Care", "BLS/ACLS", "EHR", "Medication Admin", "HIPAA"],
    typical_bullets: ["Managed 6-patient load with 98% satisfaction", "Reduced med errors via double-check protocol"] },
  { slug: "accountant", title: "Accountant", sector: "Finance", seniority: "mid",
    required_skills: ["GAAP", "Reconciliation", "Excel", "QuickBooks", "Tax"],
    typical_bullets: ["Closed monthly books in 3 days, down from 7", "Identified $50K in tax savings"] },
  { slug: "sales-executive", title: "Sales Executive", sector: "Sales", seniority: "mid",
    required_skills: ["CRM", "Negotiation", "Pipeline", "Cold Outreach", "Forecasting"],
    typical_bullets: ["Exceeded quota 120% three quarters running", "Grew territory revenue 35% YoY"] },
];

async function main() {
  if (!hasDb()) {
    console.error("No DATABASE_URL set.");
    process.exit(1);
  }
  for (const r of ROLES) {
    const text = `${r.title} ${r.sector} ${r.required_skills.join(" ")}`;
    let embedding: number[] | null = null;
    try {
      embedding = await embed(text);
    } catch (e: any) {
      console.warn(`embed skipped for ${r.slug}: ${e.message?.slice(0, 60)}`);
    }
    try {
      await q(
        `insert into roles (slug, title, sector, seniority, required_skills, preferred_skills, typical_bullets, certifications, source, embedding)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'manual',$9)
         on conflict (slug) do update set
           required_skills=excluded.required_skills,
           typical_bullets=excluded.typical_bullets,
           embedding=coalesce(excluded.embedding, roles.embedding)`,
        [r.slug, r.title, r.sector, r.seniority, r.required_skills, [], r.typical_bullets, [], vec(embedding)],
      );
      console.log(`ok ${r.slug}`);
    } catch (e: any) {
      console.log(`FAIL ${r.slug}: ${e.message}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
