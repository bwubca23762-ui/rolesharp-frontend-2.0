import { q, hasDb } from "../lib/db";
import { inferCompanyStyleProfile } from "../lib/company-context";

/**
 * Comprehensive data management — aliases, resume format rules, company cleanup.
 * Run on VPS: set -a; . ./.env; set +a; npx tsx scripts/manage-data.ts
 */

// ---- Per-country resume format rules ----
type CountryRules = {
  pages: string;        // "1" or "2"
  photo: string;        // "yes", "no", or "optional"
  personalInfo: string; // what personal details to include
  dateFormat: string;   // "MM/YYYY" or "Month YYYY"
  educationOrder: string; // "newest first" or "oldest first"
  sections: string[];   // recommended sections in order
  notes: string;
};

const RESUME_RULES: Record<string, CountryRules> = {
  US: { pages:"1", photo:"no", personalInfo:"Name, email, phone, city/state, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["summary","experience","skills","education"], notes:"No photo (anti-discrimination laws). No date of birth. One page for <10 years experience. Use action verbs + metrics." },
  IN: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"Month YYYY", educationOrder:"newest first", sections:["summary","experience","skills","education","certifications","languages"], notes:"Photo optional but common. Include 10th/12th marks for freshers. Languages section expected. 'Father's name' section is outdated — skip it." },
  GB: { pages:"2", photo:"no", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"Month YYYY", educationOrder:"newest first", sections:["personal statement","experience","skills","education","interests"], notes:"Called a 'CV' not a 'resume'. Two pages standard. Personal statement instead of summary. Interests/hobbies section common. No photo." },
  DE: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["profile","work experience","education","skills","languages"], notes:"A photo is optional, not mandatory. Do not add date of birth or nationality unless the application explicitly requests it. Use a clear Lebenslauf layout." },
  JP: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, address", dateFormat:"YYYY/MM", educationOrder:"oldest first", sections:["personal info","education","work experience","qualifications","skills"], notes:"Use the current fair-hiring rirekisho guidance. A photo is conditional, gender is optional, and outdated spouse or dependent fields should not be requested by default." },
  CN: { pages:"1", photo:"optional", personalInfo:"Name, email, phone, city", dateFormat:"YYYY/MM", educationOrder:"newest first", sections:["personal info","education","work experience","skills","certifications"], notes:"Photo and sensitive personal details are not treated as universal requirements. Include them only when a verified employer application explicitly requests them." },
  CA: { pages:"1-2", photo:"no", personalInfo:"Name, email, phone, city/province, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["summary","experience","skills","education","volunteer"], notes:"Similar to US but slightly more formal. French required for Quebec roles. 'Canadian experience' valued — highlight local roles." },
  AU: { pages:"2-3", photo:"no", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"Month YYYY", educationOrder:"newest first", sections:["professional summary","experience","skills","education","referees"], notes:"Longer than US resumes — 2-3 pages. 'Referees' section expected (name + contact). No photo. Use Australian spelling." },
  AE: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, city, visa/work authorization when relevant", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["personal info","summary","experience","skills","education","languages"], notes:"A photo is optional unless the employer requests one. Share nationality or visa details only when relevant to work authorization." },
  SG: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["summary","experience","skills","education","certifications","languages"], notes:"Clean, professional format. Add nationality or work authorization only when relevant or explicitly requested." },
  FR: { pages:"1", photo:"optional", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["personal info","experience","education","skills","languages","interests"], notes:"Keep the CV concise. A photo is optional; age and other sensitive details are omitted by default." },
  BR: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["objective","experience","education","skills","languages","courses"], notes:"Use a concise currículo. Photo, age, and marital status are not treated as universal requirements." },
  NG: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["personal info","summary","experience","skills","education","certifications","referees"], notes:"Do not request date of birth or state of origin by default. Add references only when the application asks for them." },
  PH: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["personal info","objective","experience","skills","education","training"], notes:"Use a professional resume rather than collecting biodata. Photo, birth date, and character references are optional unless explicitly requested." },
  PK: { pages:"1-2", photo:"optional", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["personal info","objective","experience","education","skills","certifications","references"], notes:"Do not request CNIC or religion on a general resume. Add references only when the employer asks for them." },
  ZA: { pages:"2-3", photo:"no", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"MM/YYYY", educationOrder:"newest first", sections:["personal details","summary","experience","education","skills","references"], notes:"Keep ID numbers off the resume. Mention a driver's licence only when it is relevant to the role." },
  NZ: { pages:"1-2", photo:"no", personalInfo:"Name, email, phone, city, LinkedIn", dateFormat:"Month YYYY", educationOrder:"newest first", sections:["summary","experience","skills","education","interests","referees"], notes:"Similar to Australia but shorter. No photo. Referees on request only. Use NZ English spelling." },
};

// ---- Company aliases (ticker/acronym mappings) ----
const ALIASES: Record<string, string[]> = {
  // US tech
  "us-google": ["GOOGL", "GOOG", "Alphabet", "Google Inc"],
  "us-apple": ["AAPL", "Apple Inc"],
  "us-microsoft": ["MSFT", "Microsoft Corp"],
  "us-amazon": ["AMZN", "Amazon.com"],
  "us-meta": ["META", "Facebook"],
  "us-nvidia": ["NVDA", "Nvidia Corp"],
  "us-tesla": ["TSLA", "Tesla Inc"],
  "us-netflix": ["NFLX", "Netflix Inc"],
  "us-salesforce": ["CRM", "Salesforce.com"],
  "us-adobe": ["ADBE", "Adobe Systems"],
  "us-oracle": ["ORCL", "Oracle Corp"],
  "us-ibm": ["IBM", "International Business Machines"],
  "us-intel": ["INTC", "Intel Corp"],
  "us-uber": ["UBER", "Uber Technologies"],
  "us-airbnb": ["ABNB", "Airbnb Inc"],
  "us-stripe": ["Stripe Inc"],
  "us-openai": ["OpenAI Inc"],
  "us-anthropic": ["Anthropic AI"],
  "us-palantir": ["PLTR", "Palantir Technologies"],
  "us-coinbase": ["COIN", "Coinbase Global"],
  // US finance
  "us-goldman-sachs": ["GS", "Goldman"],
  "us-jpmorgan-chase": ["JPM", "JPMorgan", "Chase"],
  "us-morgan-stanley": ["MS", "Morgan Stanley"],
  "us-blackrock": ["BLK", "BlackRock Inc"],
  "us-visa": ["V", "Visa Inc"],
  "us-mastercard": ["MA", "Mastercard Inc"],
  // US consulting
  "us-mckinsey-company": ["McKinsey", "McK"],
  "us-boston-consulting-group": ["BCG"],
  "us-bain-company": ["Bain", "Bain & Co"],
  "us-deloitte": ["Deloitte LLP"],
  "us-accenture": ["ACN", "Accenture PLC"],
  // US retail / consumer
  "us-walmart": ["WMT", "Walmart Inc"],
  "us-target": ["TGT", "Target Corp"],
  "us-coca-cola": ["KO", "Coke"],
  "us-pepsico": ["PEP", "Pepsi"],
  "us-nike": ["NKE", "Nike Inc"],
  "us-disney": ["DIS", "Walt Disney"],
  // India
  "in-tcs": ["TCS", "Tata Consultancy"],
  "in-infosys": ["INFY", "Infosys Ltd"],
  "in-wipro": ["WIT", "Wipro Ltd"],
  "in-hcl-technologies": ["HCL", "HCL Tech"],
  "in-tech-mahindra": ["Tech Mahindra", "TechM"],
  "in-reliance-industries": ["RIL", "Reliance"],
  // UK
  "gb-hsbc": ["HSBC Holdings", "HSBC Bank"],
  "gb-bp": ["BP PLC", "British Petroleum"],
  "gb-unilever": ["UL", "Unilever PLC"],
  "gb-astrazeneca": ["AZN", "AstraZeneca PLC"],
  // JP
  "jp-toyota": ["TM", "Toyota Motor"],
  "jp-sony": ["SONY", "Sony Group"],
  "jp-honda": ["HMC", "Honda Motor"],
  // DE
  "de-sap": ["SAP SE", "SAP AG"],
  "de-siemens": ["Siemens AG"],
  "de-volkswagen": ["VW", "Volkswagen AG"],
  "de-bmw": ["BMW AG", "Bayerische Motoren Werke"],
  // CN
  "cn-alibaba": ["BABA", "Alibaba Group"],
  "cn-tencent": ["Tencent Holdings"],
  "cn-huawei": ["Huawei Technologies"],
  // KR
  "kr-samsung-electronics": ["Samsung"],
  "kr-lg-electronics": ["LG"],
  "kr-hyundai": ["Hyundai Motor"],
  // More global
  "ch-nestle": ["Nestlé SA"],
  "fr-lvmh": ["LVMH", "Louis Vuitton"],
  "fr-totalenergies": ["Total", "TotalEnergies"],
  "nl-shell": ["Shell PLC", "Royal Dutch Shell"],
  "nl-asml": ["ASML Holding"],
};

async function main() {
  if (!hasDb()) { console.error("No DATABASE_URL"); process.exit(1); }

  // 1. Add resume format rules to countries table
  console.log("1. Adding resume format rules...");
  let rulesCount = 0;
  for (const [code, rules] of Object.entries(RESUME_RULES)) {
    await q("update countries set rules = $2 where code = $1", [code, JSON.stringify(rules)]);
    rulesCount++;
  }
  console.log(`   ${rulesCount} countries updated with resume rules`);

  // 2. Add aliases to companies
  console.log("2. Adding company aliases...");
  let aliasCount = 0;
  for (const [slug, aliases] of Object.entries(ALIASES)) {
    const existing = await q<{ name: string }>("select name from companies where slug = $1", [slug]);
    if (!existing.length) {
      console.log(`   ⚠️ slug not found: ${slug}`);
      continue;
    }
    await q("update companies set aliases = $2 where slug = $1", [slug, aliases]);
    aliasCount++;
  }
  console.log(`   ${aliasCount} companies updated with aliases`);

  // 3. Promote well-known companies to Tier A
  console.log("3. Tagging Tier A companies...");
  await q("update companies set tier = 'A' where (website is not null or industry is not null) and tier != 'A'");
  const after = Number((await q<{ n: string }>("select count(*)::int n from companies where tier = 'A'"))[0]?.n ?? 0);
  console.log(`   Tier A: ${after} companies`);

  // 4. Normalize company names — drop trailing "Inc.", "Inc" when redundant with slug
  console.log("4. Normalizing company names...");
  await q(
    `update companies set name = regexp_replace(name, '\\s+Inc\\.?\\s*$', '')
     where name ~ '\\s+Inc\\.?\\s*$' and tier != 'A'`
  );
  console.log("   Done");

  // 5. Fill inferred style profiles for Tier A rows that still lack them.
  console.log("5. Inferring style profiles for Tier A companies...");
  const missingProfiles = await q<{ id: number; sector: string | null }>(
    "select id, sector from companies where tier = 'A' and style_profile is null",
  );
  for (const row of missingProfiles) {
    await q("update companies set style_profile = $2::jsonb where id = $1", [row.id, JSON.stringify(inferCompanyStyleProfile(row.sector))]);
  }
  console.log(`   ${missingProfiles.length} Tier A companies updated`);

  // Summary
  const totals = await q<{ metric: string; value: string }>("select 'companies' m, count(*)::text v from companies union all select 'tier A', count(*)::text from companies where tier='A' union all select 'with aliases', count(*)::text from companies where aliases != '{}' union all select 'tier A styled', count(*)::text from companies where tier='A' and style_profile is not null union all select 'with rules', count(*)::text from countries where rules::text != '{}' union all select 'countries', count(*)::text from countries");
  console.log("\n=== FINAL STATE ===");
  for (const r of totals) console.log(`  ${r.metric}: ${r.value}`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
