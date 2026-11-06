import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CANONICAL_SYNONYMS,
  HIGH_SIGNAL_SHORT_TERMS,
  extractJdTerms,
  matchResumeToJob,
  compareResumes,
} from "../lib/match-engine";
import { evaluateAtsVendorCompatibility, repairBullet, terms, keywordCoverage } from "../lib/ats-score";
import { buildGeneratorVariants, wovenKeywordsFrom } from "../lib/generator-variants";
import { analyzeCoverLetter } from "../lib/cover-letter-analyzer";
import { analyseSkillGap } from "../lib/skill-gap";
import type { MapRole } from "../lib/career-map";

const source = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("high-signal short tokens survive single-occurrence extraction", () => {
  assert.ok(HIGH_SIGNAL_SHORT_TERMS.size >= 250, "expected 250+ short domain tokens");
  for (const token of ["c", "r", "go", "c#", "c++", "ai", "ml", "qa", "ui", "ux", "js", "ts"]) {
    assert.ok(HIGH_SIGNAL_SHORT_TERMS.has(token), `missing short skill token: ${token}`);
  }
  assert.ok(extractJdTerms("Requirements: C and R programming, Go, C#, C++, AI, ML, QA, UI, UX, JS, TS.").includes("c"));
  assert.ok(extractJdTerms("Requirements: C and R programming, Go, C#, C++, AI, ML, QA, UI, UX, JS, TS.").includes("r"));
  const jd = "We use dbt with Snowflake. Terraform manages the cloud.";
  void jd;
  const extracted = source("lib/match-engine.ts").includes("HIGH_SIGNAL_SHORT_TERMS.has(term)");
  assert.ok(extracted, "extractJdTerms must consult the high-signal set");
});

test("synonym rescue counts K8s as Kubernetes", () => {
  assert.ok(CANONICAL_SYNONYMS["kubernetes"].includes("k8s"));
  const jd = "Platform team. Requirements: Kubernetes operations, SQL tuning, Python automation.";
  const resume = "Ran k8s clusters, tuned SQL queries, automated with Python.";
  const result = matchResumeToJob(resume, jd);
  assert.ok(result.matched.includes("kubernetes"), "K8s must count as Kubernetes evidence");
  assert.ok(result.synonymMatches?.some((m) => m.jdTerm === "kubernetes" && m.resumeTerm === "k8s"));
});

test("ATS keyword terms retain technical short tokens and canonicalize common aliases", () => {
  const extracted = new Set(terms("C C++ C# R Go AI ML QA UI UX JavaScript TypeScript Kubernetes PostgreSQL AWS CI/CD"));
  for (const term of ["c", "c++", "c#", "r", "go", "ai", "ml", "qa", "ui", "ux", "javascript", "typescript", "kubernetes", "postgresql", "aws", "cicd"]) {
    assert.ok(extracted.has(term), `missing ATS token: ${term}`);
  }
  assert.ok(!terms("can review resumes").includes("c"), "ordinary lowercase prose must not count as the C language");
  assert.ok(!terms("our work results").includes("r"), "ordinary lowercase prose must not count as the R language");
  assert.equal(keywordCoverage("Kubernetes PostgreSQL JavaScript TypeScript AWS CI/CD", "K8s Postgres JS TS Amazon Web Services Continuous Integration"), 1);
});

test("section weights split must-have from nice-to-have", () => {
  const jd = "Data Engineer\nRequirements:\n- dbt and Kafka experience\nPreferred:\n- Snowflake";
  const resume = "dbt pipelines only.";
  const result = matchResumeToJob(resume, jd);
  assert.ok(result.mustHaveMissing?.includes("kafka"), "kafka is a requirements-section gap");
  assert.ok(result.niceToHaveMissing?.includes("snowflake"), "snowflake is a preferred-section gap");
});

test("compareResumes returns winner, delta, and unique coverage", () => {
  const jd = "Requirements: SQL, Python, Kubernetes, Kafka.";
  const a = "SQL and Python.";
  const b = "SQL, Python, Kubernetes, and Kafka.";
  const diff = compareResumes(a, b, jd);
  assert.equal(diff.winner, "b");
  assert.ok(diff.onlyB.length > 0);
});

test("5-vendor ATS simulation flags unparseable documents", () => {
  const report = evaluateAtsVendorCompatibility("x");
  // near-empty text: Greenhouse fail, Workday contact fail
  assert.equal(report.overall, "fail");
  assert.ok(report.vendors.some((v) => v.vendor === "Workday" && v.verdict === "fail"));
  const good = evaluateAtsVendorCompatibility(
    "Jane Doe — jane@example.com — 555-0100\nExperience\nSenior engineer 2019 - 2024, built skills sections and pipelines with SQL.\nSkills: SQL, Python",
  );
  assert.ok(["pass", "warn"].includes(good.overall));
});

test("bullet synthesizer classifies duty bullets and uses bracket slots, never invented numbers", () => {
  const repair = repairBullet("Responsible for sales in my region");
  assert.equal(repair.issueType, "passive_duty");
  assert.match(repair.rewrittenTemplate, /\[[X%]|\[\$X\]|\[N/);
  // Zero-fabrication: the template contains no concrete number.
  assert.doesNotMatch(repair.rewrittenTemplate, /\b\d{2,}%/);
});

test("micro-generator variants carry three angles with counts", () => {
  const out = "Led the migration of 40 services to Kubernetes, cutting deploy time 62% and saving $180k a year. The platform team adopted the pattern org-wide.";
  const variants = buildGeneratorVariants(out, ["kubernetes", "terraform"]);
  assert.equal(variants.length, 3);
  assert.deepEqual(variants.map((v) => v.id), ["impact", "technical", "concise"]);
  for (const v of variants) assert.equal(v.wordCount, v.text.split(/\s+/).filter(Boolean).length);
  assert.ok(wovenKeywordsFrom(out, ["kubernetes", "deploy time"]).includes("kubernetes"));
});

test("cover letter analyzer exposes five sub-scores and a repaired opening", () => {
  const result = analyzeCoverLetter(
    "Dear Hiring Manager, I am applying for the Senior Analyst role at Acme. I cut reporting time 40% at Northwind by rebuilding pipelines. My work maps to your requirements. Happy to discuss how I would do the same for Acme.",
    { company: "Acme", role: "Senior Analyst" },
  );
  assert.ok(result.subScores, "subScores missing");
  for (const key of ["hookScore", "specificityScore", "metricDensityScore", "clicheFreeScore", "nonDuplicationScore"]) {
    const v = (result.subScores as any)[key];
    assert.ok(v >= 0 && v <= 100, `${key} out of range: ${v}`);
  }
  assert.match(result.repairedOpeningParagraph ?? "", /\[top skill\]/);
});

test("skill-gap enriches undocumented and unproven verdicts with honest scaffolding", () => {
  const target: MapRole = {
    slug: "data-analyst",
    title: "Data Analyst",
    sector: "Data",
    required_skills: ["sql", "python", "tableau", "statistics"],
  };
  const gap = analyseSkillGap("I can use excel a bit.", target, null);
  for (const v of gap.verdicts) {
    if (v.status === "evidenced") continue;
    assert.ok(v.resumeBulletSuggestion?.includes("["), `${v.skill} bullet suggestion lacks metric slots`);
    assert.match(v.freeCertUrl ?? "", /^\/free-certifications\?topic=/);
    if (v.status === "unproven") assert.ok(v.proofProjectIdea);
  }
});
