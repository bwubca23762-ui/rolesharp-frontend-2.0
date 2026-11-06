import { q, hasDb } from "../lib/db";

// Bulk-import real companies from Wikidata into Tier B (no embedding).
// Strategy: slice BY COUNTRY (bind ISO as a literal) so each query is small
// and fast — avoids the 504s you get from P279* closures + deep OFFSET.
const ENDPOINT = "https://query.wikidata.org/sparql";
const rawPerCountry = process.env.COMPANY_PER_COUNTRY ?? "10000";
if (!/^\d+$/u.test(rawPerCountry) || Number(rawPerCountry) < 1 || Number(rawPerCountry) > 100_000) {
  throw new Error("COMPANY_PER_COUNTRY must be an integer between 1 and 100000");
}
const PER_COUNTRY = Number(rawPerCountry);
const UA = "resume-ai/1.0 (bulk company import; contact admin)";

// Common "is a company" classes in Wikidata.
const TYPES = "wd:Q4830453 wd:Q891723 wd:Q6881511 wd:Q783794 wd:Q18388277";

function bareSlug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}
// Company slugs are country-scoped: {cc}-{name}. Two countries with the same
// company name no longer collide (the old bare-slug global unique dropped them).
function slugify(s: string, iso: string): string {
  return `${iso.toLowerCase()}-${bareSlug(s)}`;
}

async function sparql(query: string, tries = 4): Promise<any[]> {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
      });
      if (res.ok) return (await res.json()).results.bindings;
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (t + 1)); continue; }
      throw new Error(`SPARQL ${res.status}`);
    } catch (e: any) {
      if (t === tries - 1) throw e;
      await sleep(3000 * (t + 1));
    }
  }
  return [];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function countries(): Promise<string[]> {
  const rows = await sparql(`SELECT DISTINCT ?iso WHERE { ?c wdt:P297 ?iso } ORDER BY ?iso`);
  return rows.map((b: any) => (b.iso?.value as string)?.toUpperCase()).filter((x: string) => x?.length === 2);
}

async function companiesIn(iso: string) {
  const query = `
    SELECT ?cLabel ?indLabel WHERE {
      VALUES ?type { ${TYPES} }
      ?cy wdt:P297 "${iso}" .
      ?c wdt:P31 ?type ; wdt:P17 ?cy .
      OPTIONAL { ?c wdt:P452 ?ind . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${PER_COUNTRY}`;
  const rows = await sparql(query);
  return rows
    .map((b: any) => ({ name: b.cLabel?.value as string, sector: b.indLabel?.value as string | undefined }))
    .filter((r: any) => r.name && !/^Q\d+$/.test(r.name));
}

async function insertBatch(rows: { name: string; sector?: string }[], iso: string) {
  const seen = new Set<string>();
  // chunk inserts to keep param counts sane
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values: string[] = [];
    const params: any[] = [];
    let p = 1;
    for (const r of chunk) {
      const slug = slugify(r.name, iso);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      values.push(`($${p++},$${p++},$${p++},$${p++},'B','wikidata')`);
      params.push(slug, r.name, iso, r.sector ?? null);
    }
    if (!values.length) continue;
    const before = Number((await q<{ n: string }>("select count(*)::int n from companies"))[0].n);
    await q(`insert into companies (slug,name,country_code,sector,tier,source) values ${values.join(",")} on conflict (slug) do nothing`, params);
    added += Number((await q<{ n: string }>("select count(*)::int n from companies"))[0].n) - before;
  }
  return added;
}

async function main() {
  if (!hasDb()) { console.error("No DATABASE_URL"); process.exit(1); }
  const isos = await countries();
  console.log(`countries with companies: ${isos.length}`);
  let total = 0;
  for (const iso of isos) {
    try {
      const rows = await companiesIn(iso);
      const added = await insertBatch(rows, iso);
      total += added;
      console.log(`${iso}: ${rows.length} fetched, +${added} new (running total ${total})`);
      await sleep(800);
    } catch (e: any) {
      console.warn(`${iso} failed: ${e.message}`);
      await sleep(2000);
    }
  }
  const n = (await q<{ n: string }>("select count(*)::int n from companies"))[0].n;
  console.log(`DONE. +${total} new this run. companies total: ${n}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
