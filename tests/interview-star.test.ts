import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { buildStarGuidance } from "../lib/interview-star";
import { ResumeContent } from "../lib/types";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Phase 6: STAR scaffolds mapped to the candidate's own evidence. Situation
// and action come verbatim from the resume the candidate submitted; the
// result line is the honest one — quantified when the bullet carries a
// metric, a prepare-or-bridge prompt when it does not. A question with no
// evidential overlap gets NO mapping: an unanchored STAR story would be an
// invitation to fabricate, and the module declines it.

const content = ResumeContent.parse({
  headline: "QA Engineer",
  summary: "Three years in web application QA.",
  skills: ["Selenium", "SQL", "API testing"],
  experiences: [
    {
      title: "QA Engineer", company: "Acme", period: "2023—2026",
      bullets: [
        "Cut regression suite time 40% by automating smoke tests with Selenium.",
        "Mentored two junior testers on test case design.",
      ],
    },
    {
      title: "Junior Tester", company: "BetaSoft", period: "2022—2023",
      bullets: ["Executed manual test passes across three releases."],
    },
  ],
  education: [{ degree: "BSc", school: "ABC" }],
});

test("a question maps to the most overlapping bullet, with an honest result line", () => {
  const { entries } = buildStarGuidance(content, [
    "Tell me about a time you improved a slow testing process.",
  ]);
  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.bullet, "Cut regression suite time 40% by automating smoke tests with Selenium.");
  assert.equal(entry.experienceTitle, "QA Engineer");
  assert.equal(entry.company, "Acme");
  assert.match(entry.situation, /As QA Engineer at Acme/u);
  assert.equal(entry.action, entry.bullet, "the action is the candidate's own claim, verbatim");
  assert.equal(entry.hasMetric, true);
  assert.match(entry.resultPrompt, /already cites a number/u, "quantified bullets get a quantify-the-outcome rehearsal prompt");
});

test("a bullet without a metric gets a prepare-or-bridge prompt, never an invented number", () => {
  // Lexically anchored to the mentoring bullet — the module maps by evidence
  // overlap, and a question about mentoring meets the mentored bullet there.
  const { entries } = buildStarGuidance(content, [
    "Tell me about a time you mentored junior testers.",
  ]);
  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.match(entry.bullet, /Mentored two junior testers/u);
  assert.equal(entry.hasMetric, false);
  assert.match(entry.resultPrompt, /without inventing a number/u);
});

test("a question with no evidential overlap gets no mapping at all", () => {
  const { entries } = buildStarGuidance(content, [
    "Why do you want to work in commercial real estate?", // nothing in this resume
  ]);
  assert.deepEqual(entries, []);
});

test("the route attaches STAR scaffolds and the panel renders them", () => {
  const route = source("app/api/interview/route.ts");
  assert.match(route, /buildStarGuidance\(parsedContent\.data/u);
  const panel = source("components/ResumeToolPanel.tsx");
  assert.match(panel, /STAR scaffolds — your own evidence/u);
  assert.match(panel, /resultPrompt/u);
});
