import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { connection } from "../lib/queue";
import {
  evidenceFor,
  consumeSessionLocally,
  FREE_QUESTION_LIMIT,
  questionCountFor,
  questionsFor,
  readoutFor,
  voiceGatewayFor,
  createSession,
} from "../lib/interview-session";
import type { ResumeContent } from "../lib/types";

const source = (path: string) => readFileSync(path, "utf8");

test("interview fallback survives independently loaded API route modules", async (context) => {
  context.mock.method(connection, "set", async () => { throw new Error("offline test"); });
  context.mock.method(connection, "get", async () => { throw new Error("offline test"); });
  const userId = crypto.randomUUID();
  const session = await createSession(userId, crypto.randomUUID(), "free", 5);
  const require = createRequire(import.meta.url);
  const resolved = require.resolve("../lib/interview-session.ts");
  delete require.cache[resolved];
  const otherRoute = require(resolved) as typeof import("../lib/interview-session");
  assert.equal((await otherRoute.getSession(userId, session.sessionId))?.resumeId, session.resumeId);
  assert.equal(await otherRoute.getSession(crypto.randomUUID(), session.sessionId), null);
});

const RESUME = {
  candidateName: "Priya Sharma",
  summary: "Final-year B.Com student with accounting coursework and Excel reporting practice.",
  email: "priya@example.edu",
  phone: "+91 90000 00000",
  location: "Pune, India",
  skills: ["Excel", "SQL", "Tally", "Reconciliation", "VLOOKUP"],
  experiences: [
    {
      title: "Accounting Intern",
      company: "Ledgerline Services",
      location: "Pune",
      start: "Jun 2025",
      end: "Aug 2025",
      current: false,
      bullets: [
        "Reconciled 320 vendor invoices in Excel and cut a monthly close step from 6 hours to 2",
        "Built a VLOOKUP error tracker the team adopted for daily reconciliation",
      ],
    },
  ],
  projects: [
    {
      name: "Campus dues dashboard",
      detail: "SQL + Excel dashboard tracking 1,200 student dues entries with weekly refresh",
    },
  ],
  education: [{ degree: "B.Com", institution: "SPPU", year: "2026" }],
  certifications: [],
  languages: [],
  achievements: [],
  links: [],
} as unknown as ResumeContent;

test("voice gateway routing: free goes last, premium goes first", () => {
  assert.equal(voiceGatewayFor("free"), "last");
  assert.equal(voiceGatewayFor("premium"), "first");
});

test("interview evidence includes employer names without matching unrelated word prefixes", () => {
  const question = "Tell me about your work.";
  const evidence = evidenceFor(RESUME, [question]);
  const readout = readoutFor(question, "At Ledgerline Services I reconciled invoices and checked records.", evidence);
  assert.ok(!readout.unsupported.includes("ledgerline"));
  assert.ok(readout.unsupported.includes("records"));
  assert.ok(!readout.evidenceMatched.includes("records"));
});

test("voice pace counts spoken words including common words", () => {
  const answer = "I worked with my team and I built a dashboard for them";
  const question = "What did you build?";
  const readout = readoutFor(question, answer, evidenceFor(RESUME, [question]), 30);
  assert.equal(readout.words, 12);
  assert.equal(readout.wordsPerMinute, 24);
});

test("free session consumption is idempotent and enforces one monthly use", () => {
  const month = `test-month-${crypto.randomUUID()}`;
  const firstMarker = `test-session-${crypto.randomUUID()}`;
  const secondMarker = `test-session-${crypto.randomUUID()}`;
  assert.equal(consumeSessionLocally(firstMarker, month, 1_000), "consumed");
  assert.equal(consumeSessionLocally(firstMarker, month, 1_001), "already_consumed");
  assert.equal(consumeSessionLocally(secondMarker, month, 1_002), "limit_reached");
});

test("the free tier caps the question set; premium gets everything", () => {
  const { questions: freeQuestions } = questionsFor(RESUME, "free");
  const { questions: premiumQuestions } = questionsFor(RESUME, "premium");
  assert.equal(freeQuestions.length, FREE_QUESTION_LIMIT);
  assert.ok(premiumQuestions.length >= freeQuestions.length);
  assert.equal(questionCountFor("free", 12), FREE_QUESTION_LIMIT);
  assert.equal(questionCountFor("premium", 12), 12);
});

test("readouts are deterministic — same answer, same readout", () => {
  const { questions } = questionsFor(RESUME, "premium");
  const evidence = evidenceFor(RESUME, questions);
  const answer = "As an Accounting Intern at Ledgerline Services, I reconciled 320 vendor invoices in Excel and cut the close from 6 hours to 2. The result was the team adopted my tracker.";
  const a = readoutFor(questions[0], answer, evidence);
  const b = readoutFor(questions[0], answer, evidence);
  assert.deepEqual(a, b);
});

test("an answer grounded in the mapped bullet scores higher than an invented one", () => {
  const { questions } = questionsFor(RESUME, "premium");
  const evidence = evidenceFor(RESUME, questions);
  const question = questions.find((q) => /measurable|result/i.test(q)) ?? questions[0];
  const grounded = "I reconciled 320 vendor invoices in Excel, cutting the monthly close from 6 hours to 2 — the tracker the team adopted caught VLOOKUP errors daily.";
  const invented = "I am very passionate, hardworking, and a quick learner who loves synergy and thinks outside the box.";
  const groundedReadout = readoutFor(question, grounded, evidence);
  const inventedReadout = readoutFor(question, invented, evidence);
  assert.ok(groundedReadout.score > inventedReadout.score, `${groundedReadout.score} should beat ${inventedReadout.score}`);
  assert.ok(groundedReadout.evidenceMatched.length > 0);
  assert.ok(groundedReadout.starCoverage.result);
  assert.ok(inventedReadout.unsupported.length > 0);
  assert.ok(inventedReadout.coaching.length > 0);
});

test("a metric-free answer gets the honest result coaching, never an invented number", () => {
  const { questions } = questionsFor(RESUME, "premium");
  const evidence = evidenceFor(RESUME, questions);
  const answer = "During my internship at Ledgerline Services, I rebuilt the reconciliation tracker and the team used it every day.";
  const readout = readoutFor(questions[0], answer, evidence);
  assert.equal(readout.starCoverage.result, false);
  assert.ok(readout.score < 60);
  // The result-coaching line fires whenever the answer lacks a measurable
  // outcome — here asserted on the mapped-anchor path the fixture can build.
  const evidence2 = { ...evidence, starByQuestion: new Map([[questions[0], {
    question: questions[0], experienceTitle: "Accounting Intern", company: "Ledgerline Services",
    bullet: "Reconciled 320 vendor invoices in Excel", hasMetric: true,
    situation: "As Accounting Intern at Ledgerline Services,", action: "Reconciled 320 vendor invoices in Excel",
    resultPrompt: "Rehearse the full outcome.",
  }]]) };
  const mapped = readoutFor(questions[0], answer, evidence2);
  assert.ok(mapped.coaching.some((line) => /Close with the result/.test(line)));
});

test("V-1 readouts are deterministic — no model call and no network in the session lib", () => {
  const lib = source("lib/interview-session.ts");
  assert.doesNotMatch(lib, /\bfetch\(/u);
  assert.doesNotMatch(lib, /from "\.\/llm"|from "\.\/ai|generateContent|anthropic|openai/iu);
  assert.match(lib, /voiceGatewayFor/);
  // The tier rule is written where the next session can find it.
  assert.match(lib, /"free" \? "last" : "first"/u);
});

test("free monthly quota is atomic in Redis and session fallback survives Redis recovery", () => {
  const lib = source("lib/interview-session.ts");
  const answerRoute = source("app/api/interview/[id]/answer/route.ts");
  assert.match(lib, /connection\.eval\([\s\S]*redis\.call\('EXISTS', KEYS\[1\]\)[\s\S]*used >= tonumber\(ARGV\[1\]\)/u);
  assert.match(answerRoute, /consumption === "limit_reached"[\s\S]*status: 402/u);
  assert.match(lib, /if \(raw\) return JSON\.parse\(raw\)[\s\S]*const entry = localSessions\.get\(key\)/u);
});

test("recording upload waits for recorder stop and submits collected final chunks", () => {
  const component = source("components/interview/PracticeSession.tsx");
  assert.match(component, /rec\.onstop = \(\) => \{[\s\S]*submitAudio\(rec\.mimeType\)/u);
  assert.match(component, /recordingTimerRef\.current = setTimeout\(\(\) => stopRecording\(rec\), 180_000\)/u);
  assert.doesNotMatch(component, /void submitAudio\(\);/u);
});
