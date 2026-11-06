import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { buildReviserMessages, buildReviewerMessages, parseReviewerVerdict } from "../lib/tailor/review";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Phase 4: drafter–reviewer separation for premium generations. The reviewer
// critiques; the reviser rewrites; the schema gate rejects anything malformed;
// every failure path fails open to the original draft. The review must never
// be able to invent experience and never able to inflate the reported ATS
// score — it did not measure one.

const draft = {
  headline: "QA Engineer",
  summary: "Detail-focused QA engineer.",
  skills: ["Selenium", "SQL"],
  experiences: [{ title: "QA Engineer", company: "Acme", period: "2023—2026", bullets: ["Cut regression time 40%."] }],
  education: [{ degree: "BSc", school: "ABC" }],
  projects: [], certifications: [], languages: [], achievements: [],
};

test("the reviewer verdict parser is tolerant by design", () => {
  assert.deepEqual(parseReviewerVerdict('{"issues":["weak verb"],"verdict":"revise"}'), { issues: ["weak verb"], verdict: "revise" });
  // Malformed JSON, wrong shapes, or an empty issue list all degrade to ship:
  assert.deepEqual(parseReviewerVerdict("not json at all"), { issues: [], verdict: "ship" });
  assert.deepEqual(parseReviewerVerdict('{"issues":[42,null],"verdict":"revise"}'), { issues: [], verdict: "ship" });
  assert.deepEqual(parseReviewerVerdict('{"issues":[],"verdict":"revise"}').verdict, "ship", "revise with no issues is a ship");
  const long = parseReviewerVerdict(JSON.stringify({ issues: Array.from({ length: 10 }, (_, i) => `issue ${i}`), verdict: "revise" }));
  assert.equal(long.issues.length, 6, "issues are capped");
});

test("reviewer and reviser prompts carry the draft, the target, and the no-invention contract", () => {
  const review = buildReviewerMessages({ draft, jdText: "JD text about Selenium", roleTitle: "QA Engineer", companyName: "Acme" });
  assert.ok(review[1].content.includes("JD text about Selenium"));
  assert.ok(review[1].content.includes("QA Engineer at Acme"));
  assert.match(review[0].content, /never suggest adding skills/);
  const revise = buildReviserMessages({ draft, issues: ["1. weak framing"], jdText: "JD" });
  assert.ok(revise[1].content.includes("weak framing"));
  assert.match(revise[0].content, /never add employers, dates, skills/);
  // No JD: the reviewer must say so, not pretend to have read one.
  const noJd = buildReviewerMessages({ draft });
  assert.match(noJd[1].content, /no job description provided/u);
});

test("the worker wires the pass behind the premium gate and fails open", () => {
  const worker = source("worker/index.ts");
  assert.match(worker, /if \(premium\) \{\s*\n\s*try \{\s*\n\s*finalContent = await reviewAndRevise\(/u);
  assert.match(worker, /failed open/u);
  // The reported score stays the drafter's own measurement.
  assert.match(worker, /const result = \{ content: finalContent, atsScore,/u);
  assert.match(worker, /inflate the score it did not measure/u);
});
