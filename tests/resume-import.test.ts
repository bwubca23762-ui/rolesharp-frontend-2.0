import test from "node:test";
import assert from "node:assert/strict";
import { parseResumeText } from "../lib/resume-import";

/**
 * Shaped like `pdftotext -layout` output for a generic one-column resume:
 * contact block, then classic section headers.
 */
const GENERIC = `
Jane Doe
Software Engineer
jane.doe@example.com | +1 555 0100 | linkedin.com/in/janedoe
San Francisco, CA

PROFESSIONAL SUMMARY
Backend engineer with six years building payments infrastructure. Owns services end to end.

WORK EXPERIENCE

Acme Corp | Senior Software Engineer | 2022 - Present
- Led billing redesign, cutting failed renewals by 18%
- Reduced p99 latency from 1.4s to 320ms

Example Systems | Software Engineer | 2019 - 2022
* Built reconciliation pipeline handling 2.3M transactions daily

EDUCATION
B.S. Computer Science | State University | 2019

SKILLS
TypeScript, Node.js, PostgreSQL, Kafka, Docker

CERTIFICATIONS
AWS Solutions Architect Associate

LANGUAGES
English, Hindi
`;

test("generic resume: identity and contact are lifted from the preamble", () => {
  const result = parseResumeText(GENERIC);
  assert.equal(result.name, "Jane Doe");
  assert.match(result.content.headline ?? "", /Software Engineer/);
  assert.equal(result.content.contact?.email, "jane.doe@example.com");
  assert.ok(result.content.contact?.phone?.includes("555 0100"));
  assert.equal(result.content.contact?.linkedin, "linkedin.com/in/janedoe");
});

test("generic resume: experience entries split on date ranges with pipe titles", () => {
  const { content } = parseResumeText(GENERIC);
  assert.equal(content.experiences.length, 2);
  assert.equal(content.experiences[0].company, "Acme Corp");
  assert.equal(content.experiences[0].title, "Senior Software Engineer");
  assert.equal(content.experiences[0].period, "2022 - Present");
  assert.ok(content.experiences[0].bullets.some((bullet) => bullet.includes("failed renewals by 18%")));
  assert.ok(content.experiences[0].bullets.every((bullet) => !/^[•\-*]\s/.test(bullet)), "bullet markers stripped");
});

test("generic resume: sections land in the right fields", () => {
  const { content } = parseResumeText(GENERIC);
  assert.match(content.summary, /payments infrastructure/);
  assert.deepEqual(content.skills.sort(), ["Docker", "Kafka", "Node.js", "PostgreSQL", "TypeScript"]);
  assert.equal(content.education[0].degree, "B.S. Computer Science");
  assert.equal(content.education[0].school, "State University");
  assert.equal(content.education[0].year, "2019");
  assert.deepEqual(content.certifications, ["AWS Solutions Architect Associate"]);
  assert.deepEqual(content.languages.sort(), ["English", "Hindi"]);
});

test("generic resume: found/warnings report what came across honestly", () => {
  const result = parseResumeText(GENERIC);
  assert.ok(result.found.some((entry) => entry.includes("2 roles")));
  assert.ok(result.found.includes("summary"));
  assert.deepEqual(result.warnings, []);
});

test("sparse resume reports warnings instead of inventing content", () => {
  const sparse = `
John Smith
john@example.com

EXPERIENCE
Some Company
Developer
2020 - Present
Did things.
`;
  const result = parseResumeText(sparse);
  assert.equal(result.content.skills.length, 0);
  assert.ok(result.warnings.some((warning) => warning.toLowerCase().includes("skills")));
  assert.ok(!result.warnings.some((warning) => warning.toLowerCase().includes("experience")), "experience was found");
});

test("dateless resumes fall back to separator lines for experience", () => {
  const dateless = `
Alex Ray
alex@example.com

WORK HISTORY
Barista | Corner Cafe
Cashier | Grocery Mart
`;
  const { content } = parseResumeText(dateless);
  assert.equal(content.experiences.length, 2);
  assert.equal(content.experiences[0].title, "Barista");
  assert.equal(content.experiences[0].company, "Corner Cafe");
});
