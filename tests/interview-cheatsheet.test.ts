import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { battlecardFor } from "../lib/interview-cheatsheet";
import { ResumeContent } from "../lib/types";

const source = (path: string) => readFileSync(path, "utf8");

const RESUME: ResumeContent = {
  candidateName: "Rhea Kumar",
  headline: "Data Analyst",
  summary: "Analyst with five years turning messy operations data into decisions.",
  skills: ["SQL", "Python", "Tableau", "Kafka", "stakeholder management"],
  experiences: [
    {
      title: "Senior Data Analyst",
      company: "Northwind Retail",
      start: "2022-01",
      end: "present",
      bullets: [
        "Cut weekly reporting time 40% by rebuilding the warehouse pipeline in dbt, freeing 6 analyst hours per week",
        "short",
        "Led the pricing dashboard adopted by 3 regional teams, used in 12 board reviews",
      ],
    },
  ],
  education: [],
} as unknown as ResumeContent;

test("battlecard stories and numbers trace to the resume — nothing invented", () => {
  const card = battlecardFor(RESUME);
  assert.ok(card.stories.length >= 1 && card.stories.length <= 3);
  // Every story bullet exists verbatim in the resume.
  const allBullets = RESUME.experiences.flatMap((e) => e.bullets);
  for (const story of card.stories) {
    assert.ok(allBullets.includes(story.bullet), `invented story: ${story.bullet}`);
  }
  // Metric bullets rank first.
  assert.ok(/\d/u.test(card.stories[0].bullet));
  // Every citable number appears in a bullet.
  for (const citable of card.citableNumbers) {
    assert.ok(citable.bullet.includes(citable.value), `invented number: ${citable.value}`);
  }
  // The sub-8-char "short" bullet never becomes a story.
  assert.ok(card.stories.every((story) => story.bullet !== "short"));
});

test("bridge lines target only unevidenced skills and refuse invented projects", () => {
  const card = battlecardFor(RESUME);
  const bulletText = RESUME.experiences[0].bullets.join(" ").toLowerCase();
  // dbt appears in a bullet — SQL appears only in the skills list.
  const bridged = card.bridgeLines.map((b) => b.skill);
  assert.ok(bridged.includes("SQL") || bridged.includes("Tableau") || bridged.includes("Kafka"));
  assert.ok(!card.bridgeLines.some((b) => bulletText.includes(b.skill.toLowerCase()) && b.skill === "dbt"));
  for (const bridge of card.bridgeLines) {
    assert.match(bridge.line, /no invented project|say honestly/u);
  }
  assert.ok(card.bridgeLines.length <= 5);
});

test("battlecard api is login-gated, ownership-checked, deterministic", () => {
  const route = source("app/api/interview/cheatsheet/route.ts");
  assert.match(route, /currentUser/u);
  assert.match(route, /rateLimit\(req, "interview-cheatsheet"/u);
  assert.match(route, /getUserResume|getDevUserResume/u);
  assert.match(route, /battlecardFor/u);
  // No model call: the only "model"/"fetch" occurrence is the comment.
  assert.doesNotMatch(route.replace(/\/\/[^\n]*/gu, ""), /model|fetch\(|generateContent/u);
});
