import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("job search pins ILIKE wildcards behind a declared escape character", () => {
  const jobs = source("lib/jobs.ts");
  // Inside a template literal, '\\' renders ONE backslash into the SQL, so
  // Postgres receives escape '\' — a single-character escape string, which is
  // what it requires (SQLSTATE 22025 otherwise: "Escape string must be empty
  // or one character"). The original '\\\\' shipped SQL escape '\\' — TWO
  // characters — and every typed jobs search 503'd in production for ~26
  // days (2026-09-20 → 2026-10-16) while this suite stayed green, because
  // the old contract asserted the broken pattern. Both are guarded now:
  // one-backslash escape required, four-backslash forbidden.
  assert.match(jobs, /ilike \$\{(titleIlike|companyIlike)\} escape '\\\\'/);
  assert.doesNotMatch(jobs, /escape '\\\\\\\\'/);
});

test("job cards read the server-computed posting age before the client clock", () => {
  const jobs = source("lib/jobs.ts");
  const finder = source("app/jobs/jobs-finder.tsx");
  assert.match(jobs, /\(current_date - date_posted::date\)\)::int posted_days_ago/);
  assert.match(finder, /posted_days_ago\?: number/);
  assert.match(finder, /formatDate\(job\.posted_days_ago, job\.date_posted\)/);
});

test("repost detection covers live cross-provider twins, not just expired cycles", () => {
  const jobs = source("lib/jobs.ts");
  // The expired-prior-cycle check (0.65) stays; live twins need the tighter
  // 0.9 bar so different roles at one company never collapse into each other.
  assert.match(jobs, /p\.expires_at <= now\(\)[\s\S]*similarity\(p\.title, jobs\.title\) >= 0\.65/);
  assert.match(jobs, /t\.expires_at > now\(\)[\s\S]*similarity\(t\.title, jobs\.title\) >= 0\.9/);
  // Live twins are flagged AND dropped: one canonical card per real opening.
  assert.match(jobs, /where not is_live_twin/);
  // The two-query flagReposts round trip is gone; the signal rides the page query.
  assert.doesNotMatch(jobs, /flagReposts/);
});

test("job search only pays for an exact count on the first page", () => {
  const jobs = source("lib/jobs.ts");
  assert.match(jobs, /if \(page === 1\)/);
  assert.match(jobs, /count\(\*\) over\(\)::int total/);
  // Later pages fetch limit+1 and report total: null instead of re-scanning.
  assert.match(jobs, /values\[values\.length - 2\] = limit \+ 1/);
  assert.match(jobs, /total: null as number \| null/);
  const finder = source("app/jobs/jobs-finder.tsx");
  assert.match(finder, /if \(typeof data\.total === "number"\) setTotal\(data\.total\)/);
  assert.doesNotMatch(finder, /setTotal\(data\.total \|\| 0\)/);
});

test("text searches rank by relevance, not just recency", () => {
  const jobs = source("lib/jobs.ts");
  // Title exact hit > company hit > location, with trigram similarity as the
  // tiebreaker and a 30-day freshness decay so stale listings cannot camp.
  assert.match(jobs, /case when title ilike \$\{titleIlike\} escape '\\\\' then 3/);
  assert.match(jobs, /similarity\(title, \$\{titleSim\}\) \* 2/);
  assert.match(jobs, /case when company ilike \$\{companyIlike\} escape '\\\\' then 1 else 0 end/);
  assert.match(jobs, /2592000/);
  // similarity() gets the RAW query — escaped LIKE wildcards would pollute
  // trigram matching.
  assert.match(jobs, /const rawQuery = input\.query\?\.trim\(\)\.slice\(0, 100\)/);
  assert.match(jobs, /values\.push\(rawQuery\)/);
  assert.match(jobs, /fuzzyValues\.push\(rawQuery\)/);
  // Relevance only overrides the default sort; explicit salary sort wins.
  assert.match(jobs, /\$\{relevanceExpr\} desc, date_posted desc nulls last/);
  assert.match(jobs, /salary_annual_usd_max desc nulls last/);
});


test("job search falls back to typo-tolerant similarity matching on empty exact results", () => {
  const jobs = source("lib/jobs.ts");
  // Fallback only fires on page 1 when exact matching found nothing.
  assert.match(jobs, /if \(rows\.length === 0 && query\)/);
  // pg_trgm similarity on the title with a 0.3 floor, ranked by similarity.
  assert.match(jobs, /similarity\(title, \$\{titleParam\}\) >= 0\.3/);
  assert.match(jobs, /order by title_similarity desc, date_posted desc/);
  // The fuzzy branch re-declares its own parameter array so $n indices stay
  // honest once the ILIKE params are gone.
  assert.match(jobs, /const fuzzyValues: unknown\[\] = \[\]/);
  // The response tells the UI the results are approximate.
  assert.match(jobs, /return \{ jobs: rows, total: Number\(rows\[0\]\?\.total \?\? 0\), page, limit, fuzzy \}/);
  const finder = source("app/jobs/jobs-finder.tsx");
  assert.match(finder, /data\.fuzzy === true/);
  assert.match(finder, /showing the closest/);
});

test("fit badges reuse the deterministic match engine and never leak description_text", () => {
  const badges = source("lib/job-fit-badges.ts");
  // Same brain as the public matcher + ATS checker — badges can never
  // disagree with the tailor flow.
  assert.match(badges, /import \{ matchResumeToJob \} from "\.\/match-engine"/);
  assert.match(badges, /import \{ resumeSourceText \} from "\.\/resume-source-text"/);
  // Thin resumes and thin JDs get no badge rather than a misleading score.
  assert.match(badges, /text\.length >= 40/);
  assert.match(badges, /result\.counts\.jdTerms < 3/);

  const route = source("app/api/jobs/route.ts");
  assert.match(route, /scoreJobPageForResume\(resumeText, result\.jobs\)/);
  // Fail-open: badge errors must never break search.
  assert.match(route, /catch \(badgeError\)/);
  // The 8k scoring field is stripped via row COPIES — the cached entry
  // keeps description_text for the next member's badges; never mutated.
  assert.match(route, /const \{ description_text: _drop, \.\.\.rest \} = job;/);
  assert.match(route, /void _drop;\s+return rest;/);

  const finder = source("app/jobs/jobs-finder.tsx");
  assert.match(finder, /Fit \{fitBadges\[job\.id\]\.fitScore\}/);
  assert.match(finder, /FIT_BADGE_STYLES/);
});

test("search-to-alert bridge posts the current query and country to the alerts API", () => {
  const finder = source("app/jobs/jobs-finder.tsx");
  assert.match(finder, /fetch\("\/api\/job-alerts"/);
  assert.match(finder, /roleKeyword: keyword, countryCode: country, frequency: "weekly"/);
  // The button re-arms when the search changes — a new query is a new alert.
  assert.match(finder, /\}, \[query, country\]\);/);
  // Tier-limit and verification errors surface as copy, not dead clicks.
  assert.match(finder, /limit_free/);
  assert.match(finder, /email_verification_required/);
});

test("description excerpts are cleaned and cut at a boundary on the server", () => {
  const jobs = source("lib/jobs.ts");
  assert.match(jobs, /function cleanExcerpt\(text: string\)/);
  assert.match(jobs, /lastIndexOf\("\. "\)/);
  const finder = source("app/jobs/jobs-finder.tsx");
  assert.doesNotMatch(finder, /description_excerpt\.replace/);
});

test("jobs search caches the user-independent page and layers badges after", () => {
  const route = source("app/api/jobs/route.ts");
  // Same convention as app/api/companies/search: bounded TtlCache, filter-set
  // key, observable via X-RoleSharp-Cache.
  assert.match(route, /new TtlCache<SearchResult>\(200, 60_000\)/);
  assert.match(route, /X-RoleSharp-Cache/);
  // The cache key covers every input that changes the result set.
  assert.match(route, /params\.country:\$\{params\.jobType\}:|country.*jobType.*remote.*sort.*page.*limit/s);
  // Badges are computed AFTER the cache lookup so a shared cached page still
  // gets per-member scores from their own resume.
  const cacheIdx = route.indexOf("searchCache.get");
  const badgeIdx = route.indexOf("scoreJobPageForResume(resumeText");
  assert.ok(cacheIdx > -1 && badgeIdx > cacheIdx, "badge scoring must run after the cache read");
});

test("salary sort runs on normalized annual-USD columns from migration 070", () => {
  const jobs = source("lib/jobs.ts");
  assert.match(jobs, /salary_annual_usd_max desc nulls last, salary_annual_usd_min desc nulls last/);
  assert.doesNotMatch(jobs, /"salary_max desc nulls last/);

  const migration = source("db/migrations/070_jobs_salary_normalization.sql");
  // Trigger-based: inserts come from the external JobSpy ingestor, so the
  // normalizer must live in the database where every write path gets it.
  assert.match(migration, /create trigger jobs_salary_normalize_trg/);
  assert.match(migration, /before insert or update of salary_min, salary_max, salary_interval, salary_currency/);
  // Interval factors mirror PERIOD_FACTOR in lib/job-match/scoring-v1.ts.
  for (const factor of ["2080", "260", "52", "12"]) assert.match(migration, new RegExp(`then ${factor}`));
  // Unknown currency normalizes to NULL, never a guess; FX is a versioned seed.
  assert.match(migration, /fx-seed-2026-09/);
  assert.match(migration, /when amount is null or amount <= 0 then null/);
  // Backfill and trigger share one function so they can never drift.
  assert.match(migration, /update jobs[\s\S]*job_salary_annual_usd\(salary_min/);
});

test("company detail pages read the same catalog the marquee links to", () => {
  const page = source("app/companies/[company]/page.tsx");
  // The landing marquee and company finder link the dev-seed catalog
  // (lib/dev-store.ts); without the local-dev fallback every linked company
  // 404s in local mode (audit: 22 broken internal links).
  assert.match(page, /import \{ getDevCompanyBySlug, listDevRoles \} from "@\/lib\/local-dev-store"/);
  assert.match(page, /env\.localDevMode[\s\S]*getDevCompanyBySlug\(slug\)/);
  assert.doesNotMatch(page, /await getCompanyBySlug\(company\)/);
  // Role lists come from the same store in local mode too.
  assert.match(page, /listDevRoles\(60\)/);
});
