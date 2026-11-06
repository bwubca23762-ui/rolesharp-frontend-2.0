import { q } from "./db";
import { hasDb } from "./db/core";

// ── Salary data over the live jobs table (T2, REDESIGN-TRACKER E2) ──
// Pure SQL — zero LLM cost. Only annual-salary listings count; hourly/weekly
// rates are a different scale and would poison percentiles.

export type SalaryStats = {
  role: string;
  country: string;
  sampleSize: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
  avgLow: number | null;
  avgHigh: number | null;
  currency: string;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — jobs refresh on rolling schedules
type CacheEntry = { expiresAt: number; data: SalaryStats };
const cache = new Map<string, CacheEntry>();

function normalizeRole(role: string): string {
  return role.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ── The one role→title matcher ──
// Every surface that turns a role name into job postings — the /salaries tool,
// its description-extraction fallback, and the programmatic salary pages —
// must ask this function. Two matchers drifted once already: a stopword-
// stripped matcher picking sitemap candidates and a raw one deciding whether
// the page renders disagreed after the third word of O*NET titles like
// "First-Line Supervisors of Office and Administrative Support Workers", so
// the sitemap advertised URLs that 404'd.
//
//   - Stopwords are stripped: "%of%" matches "software", so "of" carries no
//     signal; "except"/"other" come from O*NET titles ("...Except Mining
//     Safety Engineers") and poison the AND match.
//   - Width is 3 significant words: the first three already identify the role
//     family ("fraud examiners investigators"); five-word ANDs against the
//     taxonomy's formal titles match nothing. A visitor typing four or five
//     words gets the same leading-three match — wider, never narrower, than
//     the old per-site extractors.
export const ROLE_STOPWORDS = new Set(["and", "the", "of", "for", "to", "in", "a", "an", "on", "with", "except", "other", "others", "all", "nec"]);
export const ROLE_WORD_COUNT = 3;

export function roleWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ROLE_STOPWORDS.has(w))
    .slice(0, ROLE_WORD_COUNT);
}

// Below this sample size the numbers are noise — both the tool and the
// programmatic salary pages refuse to state them.
export const MIN_SAMPLE = 8;

// Per-country currency for the description-extraction fallback. Only countries
// with meaningful listing volume are mapped; unmapped ones keep the
// structured-fields-only path.
const COUNTRY_CURRENCY: Record<string, { symbol: string; code: string }> = {
  GB: { symbol: "£", code: "GBP" },
  IN: { symbol: "₹", code: "INR" },
  DE: { symbol: "€", code: "EUR" },
  FR: { symbol: "€", code: "EUR" },
  ES: { symbol: "€", code: "EUR" },
  IT: { symbol: "€", code: "EUR" },
  NL: { symbol: "€", code: "EUR" },
  IE: { symbol: "€", code: "EUR" },
  AE: { symbol: "د.إ", code: "AED" },
  SG: { symbol: "S$", code: "SGD" },
  CA: { symbol: "C$", code: "CAD" },
  AU: { symbol: "A$", code: "AUD" },
};

// Every market salary numbers can be stated for: structured fields (US by
// volume) plus the description-extraction markets above. The programmatic
// salary pages sweep these for sibling comparisons.
export const SALARY_COUNTRIES: string[] = ["US", ...Object.keys(COUNTRY_CURRENCY)];
export const EXTRACTION_COUNTRIES: string[] = Object.keys(COUNTRY_CURRENCY);

function extractionPattern(cc: string): { single: string; range: string; floor: number; ceiling: number } | null {
  const money = COUNTRY_CURRENCY[cc];
  if (!money) return null;
  const sym = money.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const num = "[0-9][0-9,]{2,}";
  return {
    single: `${sym}\\s?(${num})`,
    range: `${sym}\\s?(${num})\\s?(?:-|to|–|—)\\s?(?:${sym})?\\s?(${num})`,
    floor: money.code === "INR" ? 100_000 : money.code === "EUR" || money.code === "GBP" ? 10_000 : 20_000,
    ceiling: money.code === "INR" ? 20_000_000 : 2_000_000,
  };
}

/**
 * Description-extraction hits grouped by (country, title) — ONE pass over the
 * extraction markets instead of one regex query per (role, country) pair,
 * which blew Next's 60-second static-generation budget. The bounds extraction
 * and the per-currency floor/ceiling are byte-identical to
 * getSalaryStatsFromDescriptions, so a candidate counted here and a page
 * validated there always agree on the sample size — no sitemap/page drift.
 */
export async function salaryHitGroups(): Promise<Array<{ title: string; country_code: string; n: number; last_seen: string | null }>> {
  if (!hasDb()) return [];
  const parts = EXTRACTION_COUNTRIES.map(salaryExtractionCandidateSql).filter(Boolean);
  return q<{ title: string; country_code: string; n: number; last_seen: string | null }>(
    `select country_code, title, count(*)::int as n, max(last_seen_at)::text as last_seen
     from (${parts.join(" union all ")}) hits
     group by country_code, title`,
  ).catch(() => []);
}

/** A validated description-salary row, shared by the country picker and role groups. */
function salaryExtractionCandidateSql(cc: string): string {
  const pattern = extractionPattern(cc);
  if (!pattern) return "";
  return `select j.id, j.country_code, j.title, j.last_seen_at
    from jobs j
    cross join lateral (select
      (case when j.description ~ '${pattern.range}'
        then string_to_array(regexp_replace(substring(j.description from '${pattern.range}'), '[^0-9]+', '', 'g'), '|')
        else string_to_array(regexp_replace(substring(j.description from '${pattern.single}'), '[^0-9]+', '', 'g'), '|')
      end)::int[] as bounds
    ) parsed
    where j.expires_at > now() and j.country_code = '${cc}' and j.description ~ '${pattern.single}'
      and parsed.bounds[1] between ${pattern.floor} and ${pattern.ceiling}
      and coalesce(parsed.bounds[2], parsed.bounds[1]) between ${pattern.floor} and ${pattern.ceiling}`;
}

/**
 * Description-extraction fallback. The provider returns structured
 * min_amount/max_amount almost only for US listings; UK/EU/India postings put
 * the salary in the description text ("£30,000 - £40,000"). This SQL pulls the
 * FIRST salary range from each description and aggregates it. Ranges are
 * preferred; single figures count as both min and max.
 *
 * The regexes capture digits into groups and strip everything else, so the
 * array is always [min] or [min, max] of pure integers — no separator garbage.
 */
async function getSalaryStatsFromDescriptions(role: string, cc: string) {
  const money = COUNTRY_CURRENCY[cc];
  if (!money) return null;
  const cleanRole = normalizeRole(role).slice(0, 120);
  const words = roleWords(cleanRole);
  if (!words.length) return null;

  const sym = money.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const num = "[0-9][0-9,]{2,}";
  // Range: £30,000 - £40,000 | £30,000 to 40000 | ₹3,00,000–₹5,00,000.
  // Two capture groups keep only the numbers; the strip pass removes £ , and spaces.
  const rangePattern = `${sym}\\s?(${num})\\s?(?:-|to|–|—)\\s?(?:${sym})?\\s?(${num})`;
  const singlePattern = `${sym}\\s?(${num})`;
  // Salary floor scales with currency: ₹50k/month noise vs £5k junk cutoff.
  const floor = money.code === "INR" ? 100_000 : money.code === "EUR" || money.code === "GBP" ? 10_000 : 20_000;
  const ceiling = money.code === "INR" ? 20_000_000 : 2_000_000;

  const rows = await q<{ n: number; p25: number | null; p50: number | null; p75: number | null }>(
    `with hits as (
       select case
         when description ~ '${rangePattern}' then
           string_to_array(regexp_replace(substring(description from '${rangePattern}'), '[^0-9]+', '', 'g'), '|')
         else
           string_to_array(regexp_replace(substring(description from '${singlePattern}'), '[^0-9]+', '', 'g'), '|')
       end::int[] as bounds
       from jobs
       where expires_at > now()
         and country_code = $1
         and ${words.map((_, i) => `title ilike $${i + 2}`).join(" and ")}
         and description ~ '${singlePattern}'
     )
     select
       count(*)::int as n,
       percentile_cont(0.25) within group (order by ((bounds[1] + coalesce(bounds[2], bounds[1])) / 2))::int as p25,
       percentile_cont(0.5) within group (order by ((bounds[1] + coalesce(bounds[2], bounds[1])) / 2))::int as p50,
       percentile_cont(0.75) within group (order by ((bounds[1] + coalesce(bounds[2], bounds[1])) / 2))::int as p75
     from hits
     where array_length(bounds, 1) >= 1
       and bounds[1] between ${floor} and ${ceiling}
       and coalesce(bounds[2], bounds[1]) between ${floor} and ${ceiling}`,
    [cc, ...words.map((w) => `%${w}%`)],
  ).catch(() => []);

  const row = rows[0];
  if (!row || row.n < 8) return null;
  return {
    role: cleanRole,
    country: cc,
    sampleSize: row.n,
    p25: row.p25,
    median: row.p50,
    p75: row.p75,
    avgLow: row.p25,
    avgHigh: row.p75,
    currency: money.code,
  };
}

/**
 * Median/percentiles for one role keyword in one country. The role matches
 * loosely against job titles (ilike any-word) so "data analyst" also catches
 * "Senior Data Analyst - BI".
 */
export async function getSalaryStats(role: string, countryCode: string): Promise<SalaryStats | null> {
  const cleanRole = normalizeRole(role).slice(0, 120);
  const cc = countryCode.toUpperCase();
  if (!cleanRole || !/^[A-Z]{2}$/.test(cc)) return null;

  const key = `${cleanRole}|${cc}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  if (!hasDb()) return null;

  // Each whitespace word must appear in the title (AND semantics), so "data
  // analyst" doesn't match "data entry clerk". Salary floor filters the $1
  // junk rows and misparsed hourly rates.
  // Placeholders start at $2: params are [cc, ...words]. Numbering them from
  // $4 left $2/$3 referenced nowhere, and Postgres refuses to plan a statement
  // with undetermined parameter types (42P18) — every lookup 500'd.
  // Words are wrapped in %…% here: ilike 'software' only matches titles that
  // ARE exactly "software"; without wildcards every lookup found 0 rows and
  // the API answered no_data for roles that had thousands of listings.
  const words = roleWords(cleanRole);
  const conditions = words.map((_, i) => `title ilike $${i + 2}`).join(" and ");

  const rows = await q<{
    n: number; p25: number | null; p50: number | null; p75: number | null;
    avg_lo: number | null; avg_high: number | null; currency: string | null;
  }>(
    `select
       count(*)::int as n,
       percentile_cont(0.25) within group (order by ((salary_min + salary_max) / 2))::int as p25,
       percentile_cont(0.5) within group (order by ((salary_min + salary_max) / 2))::int as p50,
       percentile_cont(0.75) within group (order by ((salary_min + salary_max) / 2))::int as p75,
       round(avg(salary_min))::int as avg_lo,
       round(avg(salary_max))::int as avg_high,
       max(salary_currency) as currency
     from jobs
     where expires_at > now()
       and salary_min is not null
       and coalesce(salary_interval, '') = 'yearly'
       and salary_min between 5000 and 2000000
       and country_code = $1
       and ${conditions}`,
    [cc, ...words.map((w) => `%${w}%`)],
  );

  const row = rows[0];
  // Below this sample size the numbers are noise — refuse to state them.
  if (!row || row.n < 8) {
    // Structured fields empty for this market: try extracting from
    // description text (UK/EU/IN postings state salary in prose).
    const extracted = await getSalaryStatsFromDescriptions(cleanRole, cc);
    if (extracted) {
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data: extracted });
      return extracted;
    }
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data: null as unknown as SalaryStats });
    return null;
  }

  const stats: SalaryStats = {
    role: cleanRole,
    country: cc,
    sampleSize: row.n,
    p25: row.p25,
    median: row.p50,
    p75: row.p75,
    avgLow: row.avg_lo,
    avgHigh: row.avg_high,
    currency: row.currency ?? "USD",
  };
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data: stats });
  return stats;
}

/** Countries that have enough salary data to be worth listing in the picker —
 * structured fields AND description-extraction markets alike. The old version
 * counted structured rows only, which is why the picker (and the whole hub)
 * showed the US and nothing else: the provider fills salary_min almost
 * exclusively on US listings, while GB/IN/DE/etc. state salaries in prose. */
export async function salaryCountries(): Promise<Array<{ code: string; n: number }>> {
  if (!hasDb()) return [];
  const extracted = EXTRACTION_COUNTRIES
    .map(salaryExtractionCandidateSql)
    .filter(Boolean)
    .map((sql) => `select id, country_code from (${sql}) extracted_salary`);
  const rows = await q<{ code: string; n: number }>(
    `select country_code as code, count(distinct id)::int as n
     from (
       select id, country_code
       from jobs
       where expires_at > now() and salary_min is not null
         and coalesce(salary_interval, '') = 'yearly'
         and salary_min between 5000 and 2000000
       ${extracted.length ? `union all ${extracted.join(" union all ")}` : ""}
     ) salary_rows
     group by country_code
     having count(distinct id) >= ${MIN_SAMPLE}
     order by n desc
     limit 25`,
  );
  return rows.map(({ code, n }) => ({ code, n }));
}
