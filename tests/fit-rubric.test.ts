import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  applyDealBreakers, dealBreakerVetoes, rubricDimensions,
} from "../lib/job-match/scoring-v2";
import { JobPreferencesSchema } from "../lib/job-preferences";
import type { ScoredMatch, SignalScore } from "../lib/job-match/types";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Deal-breaker rubric v2. Two contracts: the rubric surfaces v1's five
// weighted signals as named, evidenced dimensions (explainability, no new
// math), and declared preferences veto a posting regardless of its score.
// A veto reuses the engine's own HardBlocker kinds so every downstream
// consumer treats it identically — nothing downstream learns a new shape.

const signals: SignalScore[] = [
  { signal: "required_skills", weightBasisPoints: 3000, matchBasisPoints: 8000, reliabilityBasisPoints: 9000, fitNumerator: 24, confidenceNumerator: 27, fitDisplayPoints: 24, confidenceDisplayPoints: 27, explanation: "5 of 7 required skills evidenced", provenance: ["skills:a"] },
  { signal: "preferred_skills", weightBasisPoints: 1000, matchBasisPoints: 10000, reliabilityBasisPoints: 7000, fitNumerator: 10, confidenceNumerator: 7, fitDisplayPoints: 10, confidenceDisplayPoints: 7, explanation: "Both preferred skills present", provenance: [] },
  { signal: "seniority", weightBasisPoints: 1500, matchBasisPoints: 9000, reliabilityBasisPoints: 8000, fitNumerator: 13, confidenceNumerator: 12, fitDisplayPoints: 13, confidenceDisplayPoints: 12, explanation: "Posting asks for mid; profile is mid", provenance: [] },
  { signal: "location_remote", weightBasisPoints: 1500, matchBasisPoints: 10000, reliabilityBasisPoints: 9500, fitNumerator: 15, confidenceNumerator: 14, fitDisplayPoints: 15, confidenceDisplayPoints: 14, explanation: "Remote posting matches a remote preference", provenance: [] },
  { signal: "work_type", weightBasisPoints: 500, matchBasisPoints: 10000, reliabilityBasisPoints: 9000, fitNumerator: 5, confidenceNumerator: 4, fitDisplayPoints: 5, confidenceDisplayPoints: 4, explanation: "Full-time matches", provenance: [] },
  { signal: "compensation", weightBasisPoints: 1500, matchBasisPoints: 6000, reliabilityBasisPoints: 7000, fitNumerator: 9, confidenceNumerator: 10, fitDisplayPoints: 9, confidenceDisplayPoints: 10, explanation: "Range overlaps the floor", provenance: [] },
  { signal: "freshness", weightBasisPoints: 1000, matchBasisPoints: 5000, reliabilityBasisPoints: 6000, fitNumerator: 5, confidenceNumerator: 6, fitDisplayPoints: 5, confidenceDisplayPoints: 6, explanation: "Posted 3 days ago", provenance: [] },
];

const scored: ScoredMatch = {
  kind: "scored" as const,
  scoreVersion: "job-match-v1" as const,
  normalizationVersion: "job-match-normalization-v1" as const,
  canonicalJobKey: "k", publishedAtEpochMs: 0,
  matchScore: 79, confidenceScore: 83, fitNumerator: 79, confidenceNumerator: 83,
  signals, blockers: [], automationBlockers: [],
  eligibility: { dailyDigest: true, reviewQueue: true, automaticEmail: true },
  negatedSkillIds: [],
};

test("the rubric groups the ten engine signals into five named dimensions", () => {
  const dims = rubricDimensions(signals);
  assert.deepEqual(dims.map((d) => d.id), ["skills", "seniority", "location", "compensation", "trajectory"]);
  // Skills = weight-averaged across required (3000@80%) and preferred (1000@100%).
  const skills = dims[0];
  assert.equal(skills.label, "Skills");
  assert.equal(skills.weightBasisPoints, 4000);
  assert.equal(skills.scoreBasisPoints, 8500); // (8000*3000 + 10000*1000) / 4000
  // Evidence is the weakest member signal's explanation, never the strongest.
  assert.equal(skills.evidence, "5 of 7 required skills evidenced");
  assert.ok(dims.every((d) => d.evidence.length > 0));
});

test("a posting below the declared salary floor is vetoed as a compensation conflict", () => {
  const prefs = JobPreferencesSchema.parse({ minSalary: 90000, currency: "USD", remoteOnly: false, languages: [] });
  const vetoes = dealBreakerVetoes(prefs, { compensation: { currency: "USD", upperMinor: 8_500_000 } });
  assert.equal(vetoes.length, 1);
  assert.equal(vetoes[0].kind, "compensation_conflict");
  assert.ok(vetoes[0].provenance[0].startsWith("preferences:min_salary:90000"));
});

test("a posting at or above the floor, or in another currency, is not vetoed", () => {
  const prefs = JobPreferencesSchema.parse({ minSalary: 90000, currency: "USD", remoteOnly: false, languages: [] });
  assert.equal(dealBreakerVetoes(prefs, { compensation: { currency: "USD", upperMinor: 9_000_000 } }).length, 0);
  // Currency mismatch never vetoes — comparing across currencies would be
  // fabrication, not enforcement.
  assert.equal(dealBreakerVetoes(prefs, { compensation: { currency: "INR", upperMinor: 1_000 } }).length, 0);
  assert.equal(dealBreakerVetoes(prefs, {}).length, 0);
});

test("remote_only vetoes hybrid and onsite postings", () => {
  const prefs = JobPreferencesSchema.parse({ minSalary: 0, remoteOnly: true, languages: [] });
  assert.equal(dealBreakerVetoes(prefs, { location: { remotePolicy: "remote" } }).length, 0);
  const hybrid = dealBreakerVetoes(prefs, { location: { remotePolicy: "hybrid" } });
  assert.equal(hybrid.length, 1);
  assert.equal(hybrid[0].kind, "incompatible_work_type");
});

test("a veto blocks every eligibility lane but preserves the score for the record", () => {
  const prefs = JobPreferencesSchema.parse({ minSalary: 90000, currency: "USD", remoteOnly: true, languages: [] });
  const vetoes = dealBreakerVetoes(prefs, {
    compensation: { currency: "USD", upperMinor: 1_000_000 },
    location: { remotePolicy: "onsite" },
  });
  const blocked = applyDealBreakers(scored, vetoes);
  assert.equal(blocked.blockers.length, 2);
  assert.deepEqual(blocked.eligibility, { dailyDigest: false, reviewQueue: false, automaticEmail: false });
  assert.equal(blocked.matchScore, scored.matchScore, "the score is evidence, not the verdict");
  // No preferences → identity: downstream sees byte-identical behaviour.
  assert.equal(applyDealBreakers(scored, dealBreakerVetoes(null, { compensation: { currency: "USD", upperMinor: 1 } })), scored);
});

test("preferences persistence is strict and the scorer wires the overlay per run", () => {
  const route = source("app/api/job-preferences/route.ts");
  assert.match(route, /JobPreferencesSchema\.safeParse/u);
  assert.match(route, /sameOriginRequest/u, "PUT must pass the same-origin gauntlet");
  const matches = source("lib/jobs-workflow/matches.ts");
  assert.match(matches, /getJobPreferences\(campaign\.user_id\)/u);
  assert.match(matches, /const scoreVersion = preferences \? 2 : 1;/u);
  assert.match(matches, /rubric: rubricDimensions\(effective\.signals\)/u);
  assert.match(source("lib/job-match/scoring-v2.ts"), /preferences:min_salary/u);
  assert.match(source("db/migrations/062_user_job_preferences.sql"), /create table if not exists user_job_preferences/u);
});
