import { q, hasDb } from "../lib/db";
import { embed } from "../lib/llm";
import { companyEmbeddingText, inferCompanyStyleProfile } from "../lib/company-context";

function vec(values: number[]) {
  return `[${values.join(",")}]`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Embedding quota is per-minute; a 429 just means "wait", not "give up".
// Retry with a 65s pause (up to ~20 min per item) instead of dying, so one
// run can chew through the whole corpus. Still strict: never local fallback.
async function embedPatient(text: string): Promise<number[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await embed(text, { allowLocalFallback: false });
    } catch (e: any) {
      if (attempt >= 18) throw e;
      console.log(`  rate-limited (${e.message?.slice(0, 60)}), waiting 65s [${attempt}/18]`);
      await sleep(65_000);
    }
  }
}

async function backfillRoles() {
  const roles = await q<{
    id: number;
    title: string;
    sector: string | null;
    seniority: string | null;
    required_skills: string[];
    typical_bullets: string[];
  }>(
    `select id, title, sector, seniority, required_skills, typical_bullets
     from roles
     where embedding is null
     order by id`,
  );
  let updated = 0;
  for (const role of roles) {
    const text = [
      role.title,
      role.sector ?? "",
      role.seniority ?? "",
      (role.required_skills ?? []).slice(0, 20).join(", "),
      (role.typical_bullets ?? []).slice(0, 5).join(" | "),
    ].filter(Boolean).join("\n");
    const embedding = await embedPatient(text);
    await q("update roles set embedding = $2::vector where id = $1", [role.id, vec(embedding)]);
    updated++;
    if (updated % 100 === 0) console.log(`roles: ${updated}/${roles.length}`);
  }
  return { total: roles.length, updated };
}

async function backfillCompanies() {
  const companies = await q<{
    id: number;
    slug: string;
    name: string;
    sector: string | null;
    aliases: string[];
    tier: string;
    style_profile: any;
  }>(
    `select id, slug, name, sector, aliases, tier, style_profile
     from companies
     where tier = 'A'
       and (embedding is null or style_profile is null)
     order by id`,
  );
  let updated = 0;
  for (const company of companies) {
    const profile = company.style_profile ?? inferCompanyStyleProfile(company.sector);
    const text = companyEmbeddingText({
      slug: company.slug,
      name: company.name,
      sector: company.sector,
      aliases: company.aliases,
      styleProfile: profile,
    });
    const embedding = await embedPatient(text);
    await q(
      `update companies
       set embedding = $2::vector,
           style_profile = coalesce(style_profile, $3::jsonb)
       where id = $1`,
      [company.id, vec(embedding), JSON.stringify(profile)],
    );
    updated++;
    if (updated % 100 === 0) console.log(`companies: ${updated}/${companies.length}`);
  }
  return { total: companies.length, updated };
}

async function main() {
  if (!hasDb()) {
    console.error("No DATABASE_URL");
    process.exit(1);
  }
  console.log("Backfilling role embeddings...");
  const roles = await backfillRoles();
  console.log("Backfilling Tier A company embeddings + style profiles...");
  const companies = await backfillCompanies();
  console.log(JSON.stringify({ roles, companies }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
