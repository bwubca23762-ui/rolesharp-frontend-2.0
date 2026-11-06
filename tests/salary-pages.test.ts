import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { roleWords, MIN_SAMPLE } from "../lib/salary-data";
import { collectSalaryCandidates } from "../lib/salary-pages";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// The programmatic salary pages and the /salaries tool share one matcher.
// When they had two, the sitemap advertised role×market URLs whose own stats
// 404'd them. These tests pin the matcher's contract and the pure candidate
 // accumulation, so the two surfaces cannot drift apart again.

test("roleWords strips stopwords and caps the AND-match width at three", () => {
  // Connectors carry no signal: "%of%" matches "software".
  assert.deepEqual(roleWords("First-Line Supervisors of Office and Administrative Support Workers"), [
    "first", "line", "supervisors",
  ]);
  // O*NET "Except ..." titles must not AND on the exception clause.
  assert.deepEqual(roleWords("Health and Safety Engineers, Except Mining Safety Engineers and Inspectors"), [
    "health", "safety", "engineers",
  ]);
  // Short typed roles pass through unchanged.
  assert.deepEqual(roleWords("Data Analyst"), ["data", "analyst"]);
  assert.deepEqual(roleWords("Software Engineer"), ["software", "engineer"]);
  // Single-character tokens are noise ("C# developer" would otherwise AND on "c").
  assert.deepEqual(roleWords("C# Developer"), ["developer"]);
});

test("collectSalaryCandidates ANDs every role word against the posting title", () => {
  const roles = [
    { slug: "data-analyst", title: "Data Analyst" },
    { slug: "software-engineer", title: "Software Engineer" },
  ];
  const jobs = [
    { title: "Senior Data Analyst - BI", country_code: "US", n: 5, last_seen: "2026-08-28 10:00" },
    { title: "Data Analyst", country_code: "US", n: 4, last_seen: "2026-08-28 09:00" },
    // "data" alone matches, but "analyst" is missing — AND semantics exclude it.
    { title: "Data Entry Clerk", country_code: "US", n: 40, last_seen: "2026-08-28 08:00" },
    { title: "Software Engineer", country_code: "US", n: 20, last_seen: "2026-08-28 07:00" },
  ];
  const candidates = collectSalaryCandidates(roles, jobs, 150);
  const analyst = candidates.find((c) => c.roleSlug === "data-analyst");
  assert.ok(analyst, "data analyst should qualify");
  assert.equal(analyst.sampleSize, 9, "5 + 4 postings from both matching title groups");
  assert.ok(candidates.find((c) => c.roleSlug === "software-engineer"), "software engineer should qualify");
  assert.ok(!candidates.some((c) => c.roleSlug === "data-analyst" && c.sampleSize === 40), "data entry clerk must never count toward data analyst");
});

test("collectSalaryCandidates accumulates per role and per country", () => {
  const roles = [{ slug: "data-analyst", title: "Data Analyst" }];
  const jobs = [
    { title: "Data Analyst", country_code: "US", n: 9, last_seen: "2026-08-28 10:00" },
    { title: "Data Analyst", country_code: "GB", n: 12, last_seen: "2026-08-28 11:00" },
  ];
  const candidates = collectSalaryCandidates(roles, jobs, 150);
  assert.equal(candidates.length, 2, "one candidate per (role, market) pair");
  const us = candidates.find((c) => c.countryCode === "US");
  const gb = candidates.find((c) => c.countryCode === "GB");
  assert.equal(us?.sampleSize, 9);
  assert.equal(gb?.sampleSize, 12);
  // lastSeen is the freshest observation across the accumulated groups.
  assert.equal(gb?.lastSeen, "2026-08-28 11:00");
});

test(`collectSalaryCandidates refuses samples below ${MIN_SAMPLE} — the same bar the tool states`, () => {
  const roles = [{ slug: "niche-role", title: "Niche Role" }];
  const jobs = [
    { title: "Niche Role", country_code: "US", n: MIN_SAMPLE - 1, last_seen: "2026-08-28 10:00" },
    { title: "Niche Role", country_code: "GB", n: MIN_SAMPLE, last_seen: "2026-08-28 10:00" },
  ];
  const candidates = collectSalaryCandidates(roles, jobs, 150);
  assert.ok(!candidates.some((c) => c.countryCode === "US"), "below the bar there is no page");
  assert.ok(candidates.some((c) => c.countryCode === "GB"), "at the bar the page exists");
});

test("collectSalaryCandidates respects the limit after ranking by sample size", () => {
  const roles = [
    { slug: "big-role", title: "Big Role" },
    { slug: "small-role", title: "Small Role" },
  ];
  const jobs = [
    { title: "Big Role", country_code: "US", n: 500, last_seen: null },
    { title: "Small Role", country_code: "US", n: 9, last_seen: null },
  ];
  const candidates = collectSalaryCandidates(roles, jobs, 1);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].roleSlug, "big-role", "the strongest sample wins the limit");
});

test("salary country counts union structured and extracted rows without double-counting jobs", () => {
  // The provider fills salary_min almost only on US listings; UK/IN/DE postings
  // state salaries in prose. The hub picker (salaryCountries) and the page
  // candidates (salaryJobGroups) both now sweep the description-extraction
  // hits, with the identical floor/ceiling/pattern set as the per-pair stats —
  // so a candidate counted here and a page validated there agree on sample
  // size, and the sitemap can never advertise a URL the page 404s.
  const data = source("lib/salary-data.ts");
  assert.match(data, /export async function salaryHitGroups/u);
  assert.match(data, /100_000/, "INR floor must match the per-pair extraction path");
  assert.match(data, /EXTRACTION_COUNTRIES/u);
  const picker = data.slice(data.indexOf("export async function salaryCountries"));
  assert.match(picker, /salaryExtractionCandidateSql/u);
  assert.match(picker, /count\(distinct id\)::int as n/u);
  assert.match(picker, /union all/u);
  assert.doesNotMatch(picker, /perCountry\.set\([^\n]*\+ group\.n/u);
  const pages = source("lib/salary-pages.ts");
  assert.match(pages, /salaryHitGroups\(\)/u);
});

test("salary hub degrades to readable retry guidance when live data queries fail", () => {
  const page = source("app/salaries/page.tsx");
  const client = source("app/salaries/salary-estimator-client.tsx");
  assert.match(page, /Promise\.allSettled\(/u);
  assert.match(page, /countryResult\.status === "rejected"/u);
  assert.match(client, /Salary data is temporarily unavailable/u);
  assert.match(client, /There is not enough current salary data/u);
});
