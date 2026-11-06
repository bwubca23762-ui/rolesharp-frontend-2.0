import { q } from "./db";
import { hasDb } from "./db/core";
import { getSalaryStats, roleWords, SALARY_COUNTRIES, MIN_SAMPLE, salaryHitGroups } from "./salary-data";

// ── Programmatic salary pages: /salaries/[role]/[country] ──
// One template over the live jobs table — the same dataset /salaries uses —
// turned into the role×market long-tail. Quality floor is enforced by
// construction: a page exists only if its (role, country) pair clears the
// tool's own sample bar when the build ran, and the route refuses unknown
// slug combinations (dynamicParams = false), so there is no thin-page spray.
//
// Country, not city: the ingestor does not populate `jobs.city` (0 of 227K
// rows), so a city level would be an empty promise. When ingestion starts
// filling city, a [city] level can slot UNDER these country pages.
//
// Stats come from getSalaryStats itself — the exact function behind the
// /salaries tool, structured fields plus the description-extraction fallback —
// so a page and the tool can never show different numbers for the same pair.

export type SalaryPageCandidate = {
  roleSlug: string;
  roleTitle: string;
  countryCode: string;
  sampleSize: number;
  lastSeen: string | null;
};

const SALARY_FILTER = `j.expires_at > now()
   and j.salary_min is not null
   and coalesce(j.salary_interval, '') = 'yearly'
   and j.salary_min between 5000 and 2000000`;

/**
 * The role×market combinations worth a page, ranked by structured-salary
 * sample size. The role↔title match runs in NODE, not SQL: grouping the
 * salary rows once (one indexed scan) and testing ~1K role word-sets against
 * ~10K titles with string includes is an order of magnitude faster than the
 * equivalent 9.7M-evaluation ILIKE-ALL join, which — re-run per page render —
 * blew Next's 60-second static-generation budget. The description-extraction
 * markets are NOT candidates here — they are checked per-page via
 * getSalaryStats — so every candidate has structured, verifiable postings.
 */
/**
 * The pure half of candidate selection: given the roles taxonomy and the
 * salary-bearing postings grouped by identical title, accumulate per
 * (role, market) sample sizes. Node, not SQL — testing ~1K role word-sets
 * against ~10K grouped titles here is an order of magnitude faster than the
 * equivalent 9.7M-evaluation ILIKE-ALL join, which — re-run per page render —
 * blew Next's 60-second static-generation budget. Exported for tests.
 */
export function collectSalaryCandidates(
  roleRows: Array<{ slug: string; title: string }>,
  jobGroups: Array<{ title: string; country_code: string; n: number; last_seen: string | null }>,
  limit: number,
): SalaryPageCandidate[] {
  const roles = roleRows
    .map((role) => ({ slug: role.slug, title: role.title, words: roleWords(role.title) }))
    .filter((role) => role.words.length >= 1);
  // Lowercase once per job group, not once per (role × job) pair.
  const jobs = jobGroups.map((job) => ({ ...job, lcTitle: job.title.toLowerCase() }));

  const acc = new Map<string, { roleSlug: string; roleTitle: string; countryCode: string; n: number; lastSeen: string | null }>();
  for (const role of roles) {
    for (const job of jobs) {
      if (!role.words.every((w) => job.lcTitle.includes(w))) continue;
      const key = `${role.slug}|${job.country_code}`;
      const prior = acc.get(key);
      if (prior) {
        prior.n += job.n;
        if (job.last_seen && (!prior.lastSeen || job.last_seen > prior.lastSeen)) prior.lastSeen = job.last_seen;
      } else {
        acc.set(key, { roleSlug: role.slug, roleTitle: role.title, countryCode: job.country_code.toUpperCase(), n: job.n, lastSeen: job.last_seen });
      }
    }
  }

  return [...acc.values()]
    .filter((entry) => entry.n >= MIN_SAMPLE)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((entry) => ({
      roleSlug: entry.roleSlug,
      roleTitle: entry.roleTitle,
      countryCode: entry.countryCode,
      sampleSize: entry.n,
      lastSeen: entry.lastSeen,
    }));
}

async function salaryJobGroups(): Promise<Array<{ title: string; country_code: string; n: number; last_seen: string | null }>> {
  // Structured rows (US by provider volume) AND description-extraction hits
  // (GB/IN/DE/... where salaries live in prose). Both sides apply the same
  // sample logic the tool states, so a page built from either source carries
  // the tool's own numbers. Extraction hits share the identical floor/ceiling
  // and pattern set as getSalaryStatsFromDescriptions — candidate count and
  // page count cannot drift.
  const [structured, extracted] = await Promise.all([
    q<{ title: string; country_code: string; n: number; last_seen: string | null }>(
      `select j.title, j.country_code, count(*)::int as n, max(j.last_seen_at)::text as last_seen
       from jobs j
       where ${SALARY_FILTER}
       group by j.title, j.country_code`,
    ),
    salaryHitGroups(),
  ]);
  return [...structured, ...extracted];
}

export async function salaryPageCandidates(limit = 150): Promise<SalaryPageCandidate[]> {
  if (!hasDb()) return [];
  const [roleRows, jobGroups] = await Promise.all([
    q<{ slug: string; title: string }>("select slug, title from roles"),
    salaryJobGroups(),
  ]);
  return collectSalaryCandidates(roleRows, jobGroups, limit);
}

// Static generation renders each page as its own request, so React's cache()
// alone re-runs the candidate query 150 times per build. This module-level
// memo makes it once per build worker — and, because the /salaries hub and
// the salaries sitemap also read it, once per 6h of runtime. The TTL is what
// keeps revalidation honest: without it, the first worker to fill the memo
// would serve one snapshot until restart and neither the sitemap nor the hub
// could ever reflect a page whose sample fell below the bar.
const CANDIDATE_TTL_MS = 6 * 60 * 60 * 1000;
let candidatesModuleCache: { expiresAt: number; promise: Promise<SalaryPageCandidate[]> } | null = null;

export function candidatesPromise(limit = 150): Promise<SalaryPageCandidate[]> {
  if (!candidatesModuleCache || candidatesModuleCache.expiresAt <= Date.now()) {
    const promise = salaryPageCandidates(limit);
    // A failed query must not poison the memo for six hours.
    promise.catch(() => {
      if (candidatesModuleCache?.promise === promise) candidatesModuleCache = null;
    });
    candidatesModuleCache = { expiresAt: Date.now() + CANDIDATE_TTL_MS, promise };
  }
  return candidatesModuleCache.promise;
}

export type SalaryPageStats = {
  roleTitle: string;
  countryCode: string;
  sampleSize: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
  currency: string;
  employers: Array<{ company: string; n: number; median: number | null }>;
  siblings: Array<{ countryCode: string; currency: string; sampleSize: number; median: number | null; linkable: boolean }>;
};

/**
 * Everything one page says. The headline numbers ARE the tool's numbers
 * (getSalaryStats, cache included); employers come from the structured rows;
 * siblings are the other markets the tool also covers, linked only when that
 * role×market pair is itself a prebuilt page.
 */
export async function salaryPageStats(
  roleSlug: string,
  countryCode: string,
  prebuiltSlugs: Set<string>,
): Promise<SalaryPageStats | null> {
  if (!hasDb()) return null;

  const role = (await q<{ slug: string; title: string }>(
    "select slug, title from roles where slug = $1",
    [roleSlug],
  ))[0];
  if (!role) return null;

  const cc = countryCode.toUpperCase();
  const words = roleWords(role.title);
  // The headline numbers come from getSalaryStats handed the SAME narrowed
  // word set the candidates matched on — full taxonomy titles would AND five
  // words and disagree with the candidate count.
  const stats = await getSalaryStats(words.join(" "), cc);
  if (!stats || stats.sampleSize < MIN_SAMPLE) return null;

  const employers = words.length
    ? await q<{ company: string; n: number; p50: number | null }>(
        `select j.company, count(*)::int as n,
                percentile_cont(0.5) within group (order by ((j.salary_min + j.salary_max) / 2))::int as p50
         from jobs j
         where ${SALARY_FILTER}
           and j.country_code = $1
           and j.title ilike all (array(select '%' || w || '%' from unnest($2::text[]) w))
         group by j.company
         order by n desc
         limit 5`,
        [cc, words],
      ).catch(() => [])
    : [];

  // Sibling markets in ONE grouped query (structured salary rows only).
  // Per-market getSalaryStats calls — including the description-extraction
  // fallback — cost seconds each and blew Next's 60-second page budget at
  // build time; a single GROUP BY over the market list is one scan. Markets
  // whose numbers come only from description extraction simply don't appear
  // as siblings — the tool still covers them.
  const siblings = words.length
    ? await q<{ country_code: string; n: number; p50: number | null; currency: string | null }>(
        `select j.country_code, count(*)::int as n,
                percentile_cont(0.5) within group (order by ((j.salary_min + j.salary_max) / 2))::int as p50,
                max(j.salary_currency) as currency
         from jobs j
         where ${SALARY_FILTER}
           and j.country_code = any($1::text[])
           and j.title ilike all (array(select '%' || w || '%' from unnest($2::text[]) w))
         group by j.country_code
         having count(*) >= ${MIN_SAMPLE}`,
        [SALARY_COUNTRIES, words],
      ).catch(() => [])
    : [];

  return {
    roleTitle: role.title,
    countryCode: cc,
    sampleSize: stats.sampleSize,
    p25: stats.p25,
    median: stats.median,
    p75: stats.p75,
    currency: stats.currency,
    employers: employers.map((e) => ({ company: e.company, n: e.n, median: e.p50 })),
    siblings: siblings
      .filter((s) => s.country_code.toUpperCase() !== cc)
      .map((s) => ({
        countryCode: s.country_code.toUpperCase(),
        currency: s.currency ?? "USD",
        sampleSize: s.n,
        median: s.p50,
        linkable: prebuiltSlugs.has(`${roleSlug}/${s.country_code.toLowerCase()}`),
      }))
      .sort((a, b) => (b.linkable ? 1 : 0) - (a.linkable ? 1 : 0) || b.sampleSize - a.sampleSize),
  };
}
