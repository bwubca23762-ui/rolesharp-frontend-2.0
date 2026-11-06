import { q, hasDb } from "../lib/db";
import { resumeMarketRules } from "../lib/resume-market-rules";

/**
 * Fix countries data:
 * 1. Names for 30 countries that only have ISO codes (Wikidata import artifact)
 * 2. Priority levels matching JOB_COUNTRIES config
 * 3. Remove historical codes (DD, YU)
 * 4. Proper resume format rules for all major markets
 *
 * Run on VPS:
 *   set -a; . /opt/resume-ai/.env; set +a; npx tsx scripts/fix-countries.ts
 */

const COUNTRY_NAMES: Record<string, string> = {
  AW: "Aruba",
  BM: "Bermuda",
  CW: "Curaçao",
  DD: "East Germany",
  FO: "Faroe Islands",
  GG: "Guernsey",
  GI: "Gibraltar",
  GL: "Greenland",
  IM: "Isle of Man",
  JE: "Jersey",
  KI: "Kiribati",
  KM: "Comoros",
  KN: "Saint Kitts and Nevis",
  KP: "North Korea",
  KY: "Cayman Islands",
  MH: "Marshall Islands",
  MS: "Montserrat",
  NR: "Nauru",
  PW: "Palau",
  SB: "Solomon Islands",
  SM: "San Marino",
  ST: "São Tomé and Príncipe",
  TL: "Timor-Leste",
  TV: "Tuvalu",
  VG: "British Virgin Islands",
  VI: "U.S. Virgin Islands",
  VU: "Vanuatu",
  WS: "Samoa",
  XK: "Kosovo",
  YU: "Yugoslavia",
};

// Priority tiers matching job-config.ts:
// 1-9 = tier 1 (most important markets)
// 10-25 = tier 2
// 26-100 = tier 3
// 100+ = not in job-config (lower priority)
const PRIORITIES: Record<string, number> = {
  US: 1, GB: 2, CA: 3, IN: 4, DE: 5, FR: 6, ES: 7, JP: 8, AE: 9,
  AU: 10, BR: 11, MX: 12, IT: 13, NL: 14, SG: 15, IE: 16,
  PL: 17, PT: 18, SE: 19, CH: 20, TR: 21, SA: 22, KR: 23,
  ZA: 24, NG: 25, PH: 26, ID: 27, PK: 28, NZ: 29,
  AR: 30, AT: 31, BH: 32, BD: 33, BE: 34, BG: 35, CL: 36, CN: 37,
  CO: 38, CR: 39, HR: 40, CY: 41, CZ: 42, DK: 43, EC: 44, EG: 45,
  EE: 46, FI: 47, GR: 48, HK: 49, HU: 50, IL: 51, KW: 52,
  LV: 53, LT: 54, LU: 55, MY: 56, MT: 57, MA: 58, NO: 59,
  OM: 60, PA: 61, PE: 62, QA: 63, RO: 64, SK: 65, SI: 66,
  TH: 67, TW: 68, UA: 69, UY: 70, VE: 71, VN: 72,
};

async function main() {
  if (!hasDb()) { console.error("No DATABASE_URL"); process.exit(1); }

  // 1. Fix missing country names
  console.log("1. Fixing country names...");
  let nameFixes = 0;
  for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
    await q("UPDATE countries SET name = $1 WHERE code = $2 AND name = $2", [name, code]);
    nameFixes++;
  }
  console.log(`   Updated ${nameFixes} country names`);

  // 2. Remove historical codes (East Germany, Yugoslavia)
  console.log("2. Removing historical country codes...");
  await q("DELETE FROM countries WHERE code IN ('DD', 'YU')");
  console.log("   Removed DD, YU");

  // 3. Set priorities for all 72+ JOB_COUNTRIES
  console.log("3. Setting country priorities...");
  let priorityCount = 0;
  for (const [code, priority] of Object.entries(PRIORITIES)) {
    await q("UPDATE countries SET priority = $1 WHERE code = $2", [priority, code]);
    priorityCount++;
  }
  console.log(`   Set priorities for ${priorityCount} countries`);

  // 4. Add sourced rules where verified and conservative defaults elsewhere.
  console.log("4. Adding sourced resume format rules...");
  let rulesCount = 0;
  for (const code of Object.keys(PRIORITIES)) {
    const rules = resumeMarketRules(code);
    await q("UPDATE countries SET rules = $1::jsonb WHERE code = $2", [JSON.stringify(rules), code]);
    rulesCount++;
  }
  console.log(`   Added resume rules for ${rulesCount} countries`);

  // 5. Verify final state
  console.log("\n5. Final verification:");
  const total = await q<{ n: string }>("SELECT count(*)::text as n FROM countries");
  const withCompanies = await q<{ n: string }>(
    "SELECT count(DISTINCT c.code)::text as n FROM countries c JOIN companies co ON co.country_code = c.code"
  );
  const totalCompanies = await q<{ n: string }>("SELECT count(*)::text as n FROM companies");
  const top10 = await q<{ code: string; name: string; priority: string; company_count: string }>(
    `SELECT c.code, c.name, c.priority::text,
            count(co.*)::text as company_count
     FROM countries c
     LEFT JOIN companies co ON co.country_code = c.code
     WHERE c.priority <= 10
     GROUP BY c.code, c.name, c.priority
     ORDER BY c.priority`
  );

  console.log(`   Total countries: ${total[0]?.n ?? "?"}`);
  console.log(`   Countries with companies: ${withCompanies[0]?.n ?? "?"}`);
  console.log(`   Total companies: ${totalCompanies[0]?.n ?? "?"}`);
  console.log("\n   Top priority markets:");
  for (const row of top10) {
    console.log(`     ${row.code} ${row.name} (pri=${row.priority}) — ${row.company_count} companies`);
  }

  console.log("\n=== DONE ===");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
