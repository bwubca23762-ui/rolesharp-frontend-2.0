import { q, hasDb } from "../lib/db";

/**
 * RECOVERY: my US importer's `ON CONFLICT DO UPDATE SET country_code='US'`
 * wrongly flipped ~524 non-US Wikidata companies to US. Re-derive each row's
 * real country from Wikidata (P17) by exact English label, and restore it.
 * Rows that can't be resolved are left for manual review (logged, not changed).
 *
 * Run on VPS: set -a; . ./.env; set +a; npx tsx scripts/recover-flipped-countries.ts
 */
const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "rolesharp/1.0 (country recovery; admin@rolesharp.com)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sparql(query: string, tries = 4): Promise<any[]> {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
      });
      if (res.ok) return (await res.json()).results.bindings;
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (t + 1)); continue; }
      throw new Error(`SPARQL ${res.status}`);
    } catch (e: any) {
      if (t === tries - 1) throw e;
      await sleep(2500 * (t + 1));
    }
  }
  return [];
}

// Escape a label for use inside a SPARQL string literal.
function esc(s: string) { return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

async function countryOf(name: string): Promise<string | null> {
  // Find an entity whose English label matches the name and that has a country (P17)
  // whose ISO-3166 alpha-2 (P297) we can read. Prefer the one that IS a company.
  const query = `
    SELECT ?iso WHERE {
      ?c rdfs:label "${esc(name)}"@en .
      ?c wdt:P17 ?country .
      ?country wdt:P297 ?iso .
    } LIMIT 1`;
  const rows = await sparql(query);
  const iso = rows[0]?.iso?.value?.toUpperCase();
  return iso && iso.length === 2 ? iso : null;
}

async function main() {
  if (!hasDb()) { console.error("No DATABASE_URL"); process.exit(1); }
  const flipped = await q<{ id: string; name: string; slug: string }>(
    "select id, name, slug from companies where country_code='US' and source='wikidata' order by name",
  );
  console.log(`flipped rows to recover: ${flipped.length}`);

  let fixed = 0, stayedUs = 0, unresolved = 0;
  const unresolvedList: string[] = [];

  for (const row of flipped) {
    try {
      const iso = await countryOf(row.name);
      await sleep(350);
      if (!iso) { unresolved++; unresolvedList.push(row.name); continue; }
      if (iso === "US") { stayedUs++; continue; } // genuinely US, leave as-is
      await q("update companies set country_code=$1 where id=$2", [iso, row.id]);
      fixed++;
      if (fixed % 25 === 0) console.log(`  …${fixed} restored (latest: ${row.name} → ${iso})`);
    } catch (e: any) {
      unresolved++; unresolvedList.push(`${row.name} (err: ${e.message})`);
      await sleep(1500);
    }
  }

  console.log(`\nDONE. restored=${fixed}, genuinely-US=${stayedUs}, unresolved=${unresolved}`);
  if (unresolvedList.length) {
    console.log("Unresolved (left as US, review manually):");
    unresolvedList.slice(0, 60).forEach((n) => console.log("  -", n));
    if (unresolvedList.length > 60) console.log(`  …and ${unresolvedList.length - 60} more`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
