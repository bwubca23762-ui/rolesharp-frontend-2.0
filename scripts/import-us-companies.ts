import { q, hasDb } from "../lib/db";
import { inferCompanyStyleProfile } from "../lib/company-context";

/**
 * US company importer — three free sources, no API keys:
 *   1. SEC EDGAR company_tickers.json (~10k publicly registered US firms) → Tier B
 *   2. S&P 500 list (GitHub datasets CSV) → Tier A, with sector/industry
 *   3. Curated top-50 (Google, Apple, OpenAI, …) → Tier A, website + industry prefilled
 *
 * Precedence: a later source UPGRADES an existing row (tier A wins, website/industry
 * filled) via ON CONFLICT … DO UPDATE. Run on the VPS (DB is localhost-only):
 *   set -a; . ./.env; set +a; npx tsx scripts/import-us-companies.ts
 */

const UA = "rolesharp/1.0 (us company import; admin@rolesharp.com)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function bareSlug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}
// Company slugs are country-scoped: {cc}-{name}. This is the global identity.
function slugify(s: string): string {
  return `us-${bareSlug(s)}`;
}

// Strip common corporate suffixes/noise from EDGAR's ALL-CAPS legal names so
// "ALPHABET INC." → "Alphabet", and Title-case the rest.
function cleanName(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/[\/,]+.*$/, "").trim(); // drop "/DE", ", INC" tails
  s = s.replace(/\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LLC|L\.?L\.?C|PLC|HOLDINGS?|GROUP|THE|CLASS [A-C]|COM|N\.?V|S\.?A)\.?\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[\s.,&/-]+$/, "").replace(/^[\s.,&/-]+/, "").trim(); // strip dangling punctuation
  if (!s) s = raw.trim();
  // Title-case if it's all-caps or all-lower.
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    s = s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  }
  return s.slice(0, 120);
}

type Row = {
  name: string;
  slug: string;
  tier: "A" | "B";
  sector?: string;
  industry?: string;
  website?: string;
  source: string;
  styleProfile?: unknown;
};

async function upsert(rows: Row[]): Promise<number> {
  let added = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const seen = new Set<string>();
    const values: string[] = [];
    const params: any[] = [];
    let p = 1;
    for (const r of chunk) {
      if (!r.slug || seen.has(r.slug)) continue;
      seen.add(r.slug);
      const styleProfile = r.styleProfile ?? (r.tier === "A" ? inferCompanyStyleProfile(r.sector) : null);
      values.push(`($${p++},$${p++},'US',$${p++},$${p++},$${p++},$${p++},$${p++},$${p++}::jsonb)`);
      params.push(r.slug, r.name, r.tier, r.sector ?? null, r.industry ?? null, r.website ?? null, r.source, styleProfile ? JSON.stringify(styleProfile) : null);
    }
    if (!values.length) continue;
    const before = Number((await q<{ n: string }>("select count(*)::int n from companies"))[0].n);
    // DO UPDATE so a later, richer source upgrades an earlier bare row:
    // tier 'A' always wins; sector/industry/website fill when previously null.
    // NOTE: slugs are country-scoped (us-*), so a conflict is ALWAYS the same
    // US company — we never touch country_code (that bug is structurally gone).
    await q(
      `insert into companies (slug,name,country_code,tier,sector,industry,website,source,style_profile)
       values ${values.join(",")}
       on conflict (slug) do update set
         tier     = case when companies.tier = 'A' or excluded.tier = 'A' then 'A' else companies.tier end,
         sector   = coalesce(companies.sector,   excluded.sector),
         industry = coalesce(companies.industry, excluded.industry),
         website  = coalesce(companies.website,  excluded.website),
         style_profile = coalesce(companies.style_profile, excluded.style_profile)`,
      params,
    );
    added += Number((await q<{ n: string }>("select count(*)::int n from companies"))[0].n) - before;
  }
  return added;
}

// ---------- Source 1: SEC EDGAR ----------
async function fromEdgar(): Promise<Row[]> {
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`EDGAR ${res.status}`);
  const data = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const rows: Row[] = [];
  for (const v of Object.values(data)) {
    const name = cleanName(v.title);
    const slug = slugify(name);
    if (slug.length < 2) continue;
    rows.push({ name, slug, tier: "B", source: "sec-edgar" });
  }
  return rows;
}

// ---------- Source 2: S&P 500 ----------
async function fromSP500(): Promise<Row[]> {
  const res = await fetch(
    "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv",
    { headers: { "User-Agent": UA } },
  );
  if (!res.ok) throw new Error(`SP500 ${res.status}`);
  const csv = await res.text();
  const lines = csv.split(/\r?\n/).slice(1).filter(Boolean);
  const rows: Row[] = [];
  for (const line of lines) {
    // CSV: Symbol,Security,GICS Sector,GICS Sub-Industry,Headquarters Location,Date added,CIK,Founded
    const cols = parseCsvLine(line);
    const name = cleanName(cols[1] || "");
    const slug = slugify(name);
    if (slug.length < 2) continue;
    rows.push({ name, slug, tier: "A", sector: cols[2] || undefined, industry: cols[3] || undefined, source: "sp500" });
  }
  return rows;
}

// Minimal CSV line parser (handles quoted fields with commas).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// ---------- Source 3: curated top firms ----------
const CURATED: { name: string; website: string; industry: string; sector?: string }[] = [
  { name: "Google", website: "google.com", industry: "Internet & Search", sector: "Technology" },
  { name: "Apple", website: "apple.com", industry: "Consumer Electronics", sector: "Technology" },
  { name: "Microsoft", website: "microsoft.com", industry: "Software", sector: "Technology" },
  { name: "Amazon", website: "amazon.com", industry: "E-commerce & Cloud", sector: "Technology" },
  { name: "Meta", website: "meta.com", industry: "Social Media", sector: "Technology" },
  { name: "OpenAI", website: "openai.com", industry: "Artificial Intelligence", sector: "Technology" },
  { name: "Anthropic", website: "anthropic.com", industry: "Artificial Intelligence", sector: "Technology" },
  { name: "Nvidia", website: "nvidia.com", industry: "Semiconductors", sector: "Technology" },
  { name: "Netflix", website: "netflix.com", industry: "Streaming Media", sector: "Communication Services" },
  { name: "Tesla", website: "tesla.com", industry: "Electric Vehicles", sector: "Consumer Discretionary" },
  { name: "Salesforce", website: "salesforce.com", industry: "Enterprise Software", sector: "Technology" },
  { name: "Adobe", website: "adobe.com", industry: "Creative Software", sector: "Technology" },
  { name: "Oracle", website: "oracle.com", industry: "Database & Cloud", sector: "Technology" },
  { name: "IBM", website: "ibm.com", industry: "IT Services", sector: "Technology" },
  { name: "Intel", website: "intel.com", industry: "Semiconductors", sector: "Technology" },
  { name: "Uber", website: "uber.com", industry: "Ride-hailing & Delivery", sector: "Technology" },
  { name: "Airbnb", website: "airbnb.com", industry: "Travel & Hospitality", sector: "Consumer Discretionary" },
  { name: "Stripe", website: "stripe.com", industry: "Payments", sector: "Financial Services" },
  { name: "Goldman Sachs", website: "goldmansachs.com", industry: "Investment Banking", sector: "Financial Services" },
  { name: "JPMorgan Chase", website: "jpmorganchase.com", industry: "Banking", sector: "Financial Services" },
  { name: "Morgan Stanley", website: "morganstanley.com", industry: "Investment Banking", sector: "Financial Services" },
  { name: "BlackRock", website: "blackrock.com", industry: "Asset Management", sector: "Financial Services" },
  { name: "Visa", website: "visa.com", industry: "Payments", sector: "Financial Services" },
  { name: "Mastercard", website: "mastercard.com", industry: "Payments", sector: "Financial Services" },
  { name: "McKinsey & Company", website: "mckinsey.com", industry: "Management Consulting", sector: "Professional Services" },
  { name: "Boston Consulting Group", website: "bcg.com", industry: "Management Consulting", sector: "Professional Services" },
  { name: "Bain & Company", website: "bain.com", industry: "Management Consulting", sector: "Professional Services" },
  { name: "Deloitte", website: "deloitte.com", industry: "Consulting & Audit", sector: "Professional Services" },
  { name: "PwC", website: "pwc.com", industry: "Consulting & Audit", sector: "Professional Services" },
  { name: "EY", website: "ey.com", industry: "Consulting & Audit", sector: "Professional Services" },
  { name: "KPMG", website: "kpmg.com", industry: "Consulting & Audit", sector: "Professional Services" },
  { name: "Accenture", website: "accenture.com", industry: "IT Consulting", sector: "Professional Services" },
  { name: "Walmart", website: "walmart.com", industry: "Retail", sector: "Consumer Staples" },
  { name: "Target", website: "target.com", industry: "Retail", sector: "Consumer Staples" },
  { name: "Coca-Cola", website: "coca-cola.com", industry: "Beverages", sector: "Consumer Staples" },
  { name: "PepsiCo", website: "pepsico.com", industry: "Food & Beverages", sector: "Consumer Staples" },
  { name: "Nike", website: "nike.com", industry: "Apparel & Footwear", sector: "Consumer Discretionary" },
  { name: "Disney", website: "disney.com", industry: "Entertainment", sector: "Communication Services" },
  { name: "Boeing", website: "boeing.com", industry: "Aerospace", sector: "Industrials" },
  { name: "Lockheed Martin", website: "lockheedmartin.com", industry: "Defense", sector: "Industrials" },
  { name: "Pfizer", website: "pfizer.com", industry: "Pharmaceuticals", sector: "Healthcare" },
  { name: "Johnson & Johnson", website: "jnj.com", industry: "Pharmaceuticals", sector: "Healthcare" },
  { name: "Moderna", website: "modernatx.com", industry: "Biotechnology", sector: "Healthcare" },
  { name: "UnitedHealth Group", website: "unitedhealthgroup.com", industry: "Health Insurance", sector: "Healthcare" },
  { name: "ExxonMobil", website: "exxonmobil.com", industry: "Oil & Gas", sector: "Energy" },
  { name: "Chevron", website: "chevron.com", industry: "Oil & Gas", sector: "Energy" },
  { name: "AT&T", website: "att.com", industry: "Telecommunications", sector: "Communication Services" },
  { name: "Verizon", website: "verizon.com", industry: "Telecommunications", sector: "Communication Services" },
  { name: "Palantir", website: "palantir.com", industry: "Data Analytics", sector: "Technology" },
  { name: "Coinbase", website: "coinbase.com", industry: "Cryptocurrency", sector: "Financial Services" },
];

function fromCurated(): Row[] {
  return CURATED.map((c) => ({
    name: c.name,
    slug: slugify(c.name),
    tier: "A" as const,
    sector: c.sector,
    industry: c.industry,
    website: c.website,
    source: "curated",
    styleProfile: inferCompanyStyleProfile(c.sector),
  }));
}

async function main() {
  if (!hasDb()) { console.error("No DATABASE_URL"); process.exit(1); }
  const before = Number((await q<{ n: string }>("select count(*)::int n from companies where country_code='US'"))[0].n);
  console.log(`US companies before: ${before}`);

  // Order matters: bulk EDGAR first, then S&P 500 + curated upgrade rows.
  const steps: [string, () => Promise<Row[]>][] = [
    ["SEC EDGAR", fromEdgar],
    ["S&P 500", fromSP500],
    ["Curated top-50", async () => fromCurated()],
  ];

  for (const [label, fn] of steps) {
    try {
      const rows = await fn();
      const added = await upsert(rows);
      console.log(`${label}: ${rows.length} fetched, +${added} new`);
      await sleep(500);
    } catch (e: any) {
      console.warn(`${label} FAILED: ${e.message}`);
    }
  }

  const after = Number((await q<{ n: string }>("select count(*)::int n from companies where country_code='US'"))[0].n);
  const tierA = Number((await q<{ n: string }>("select count(*)::int n from companies where country_code='US' and tier='A'"))[0].n);
  console.log(`US companies after: ${after} (+${after - before}). Tier A: ${tierA}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
