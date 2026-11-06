import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  INTERVIEW_PERSONAS,
  personaFor,
  questionCacheKey,
} from "../lib/voice/tts";
import {
  altitudeAdaptation,
  panelFollowUps,
} from "../lib/interview-panel";
import { ResumeContent } from "../lib/types";

const source = (path: string) => readFileSync(path, "utf8");

const RESUME: ResumeContent = {
  candidateName: "Rhea Kumar",
  headline: "Data Analyst",
  summary: "Analyst with five years turning messy operations data into decisions.",
  skills: ["SQL", "Python", "Tableau", "stakeholder management"],
  experiences: [
    {
      title: "Senior Data Analyst",
      company: "Northwind Retail",
      start: "2022-01",
      end: "present",
      bullets: [
        "Cut weekly reporting time 40% by rebuilding the warehouse pipeline in dbt, freeing 6 analyst hours per week",
        "Led the pricing dashboard adopted by 3 regional teams, used in 12 board reviews",
      ],
    },
  ],
  education: [],
} as unknown as ResumeContent;

test("panel personas are three altitudes on distinct prebuilt voices", () => {
  assert.equal(INTERVIEW_PERSONAS.length, 3);
  assert.deepEqual(INTERVIEW_PERSONAS.map((p) => p.altitude), ["screening", "probe", "strategic"]);
  assert.equal(new Set(INTERVIEW_PERSONAS.map((p) => p.voice)).size, 3);
  // Persona voices must differ from the default question voice so the cache
  // namespaces stay separate.
  assert.ok(INTERVIEW_PERSONAS.every((p) => p.voice !== "Kore"));
  assert.equal(personaFor("hiring_manager")?.name, "The hiring manager");
  assert.equal(personaFor("nope"), null);
});

test("persona audio keys stay content-addressed per voice", () => {
  const base = questionCacheKey("Q");
  const persona = questionCacheKey("Q", "Charon");
  assert.notEqual(base, persona);
  assert.equal(questionCacheKey("Q", "Charon"), persona);
});

test("follow-ups anchor to the resume's own evidence and never invent bullets", () => {
  const { followUps, star } = panelFollowUps("Tell me about a measurable result you delivered.", RESUME);
  assert.equal(followUps.length, 3);
  assert.match(followUps[0].question, /Senior Data Analyst|Northwind/u);
  assert.ok(followUps.every((f) => f.anchorBullet === null || RESUME.experiences[0].bullets.includes(f.anchorBullet!)));
  assert.equal(star?.experienceTitle, "Senior Data Analyst");

  // A question with no term overlap falls back to the strongest evidenced
  // bullet — the panel drills the resume's own evidence, it never invents.
  const generic = panelFollowUps("What is your greatest weakness?", RESUME);
  assert.ok(generic.star);
  assert.ok(RESUME.experiences[0].bullets.includes(generic.star!.bullet));
  assert.ok(generic.followUps.every((f) => f.anchorBullet === null || RESUME.experiences[0].bullets.includes(f.anchorBullet!)));

  // A resume with no bullets at all gets the honest generic follow-ups.
  const empty = panelFollowUps("Tell me about yourself.", { ...RESUME, experiences: [] } as ResumeContent);
  assert.equal(empty.star, null);
  assert.ok(empty.followUps.every((f) => f.anchorBullet === null));
  assert.match(empty.followUps[1].question, /hardest call/u);
});

test("altitude readout rewards posture changes and punishes a scripted same answer", () => {
  const varied = altitudeAdaptation([
    { personaId: "recruiter", answer: "I rebuilt the weekly reporting pipeline at Northwind. It cut reporting time by 40% and freed six analyst hours a week." },
    { personaId: "hiring_manager", answer: "The hardest call in the dbt rebuild was retiring legacy models mid-quarter: 42 dashboards depended on them. I ran both pipelines for 30 days, validated row counts daily, and cut over team by team with rollback points documented in the migration runbook." },
    { personaId: "executive", answer: "The strategic value was decision speed — leadership stopped debating whose numbers were right and started debating what to do. Next I would scale that trust to pricing, where the same governance would compound across regions." },
  ]);
  assert.equal(varied.score, 100);
  assert.equal(varied.sameAnswerPenalty, false);
  assert.ok(varied.coaching.length >= 1);

  const scripted = altitudeAdaptation([
    { personaId: "recruiter", answer: "I rebuilt the pipeline and cut reporting time 40%." },
    { personaId: "hiring_manager", answer: "I rebuilt the pipeline and cut reporting time 40%." },
    { personaId: "executive", answer: "I rebuilt the pipeline and cut reporting time 40%." },
  ]);
  assert.equal(scripted.sameAnswerPenalty, true);
  assert.ok(scripted.score < 100);
  assert.ok(scripted.coaching.some((line) => line.includes("rehearsed script")));
});

test("panel api is login-gated, ownership-checked, and deterministic; tts stays premium-free for cached personas", () => {
  const route = source("app/api/interview/panel/route.ts");
  assert.match(route, /currentUser/u);
  assert.match(route, /rateLimit\(req, "interview-panel"/u);
  assert.match(route, /getUserResume|getDevUserResume/u);
  assert.match(route, /panelFollowUps/u);
  const ttsRoute = source("app/api/interview/tts/route.ts");
  assert.match(ttsRoute, /personaFor/u);
});
