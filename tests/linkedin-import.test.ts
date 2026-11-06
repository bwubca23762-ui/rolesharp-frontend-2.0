import test from "node:test";
import assert from "node:assert/strict";
import { parseLinkedinProfile, looksLikeLinkedinExport } from "../lib/linkedin-import";

/**
 * Shaped like the text `pdftotext -layout` produces for a LinkedIn
 * "Save to PDF" export: sidebar first, then name, headline, location, then the
 * main sections, with a page footer partway through.
 */
const EXPORT = `
   Contact
   www.linkedin.com/in/priya-shah-4821 (LinkedIn)
   priya.shah@example.com
   +91 98765 43210

   Top Skills
   TypeScript
   PostgreSQL
   Kubernetes

   Languages
   English (Native or Bilingual)
   Hindi (Professional Working)

   Certifications
   AWS Solutions Architect, Associate

   Honors-Awards
   Internal engineering award, 2024

Priya Shah
Senior Software Engineer at Fictional Payments
Bengaluru, Karnataka, India

Summary
Backend engineer with seven years on high-throughput payment systems.
Owns services end to end, from schema design through on-call.

Experience

Fictional Payments Ltd
Senior Software Engineer
January 2022 - Present (3 years 7 months)
Bengaluru, Karnataka, India
Led the billing-flow redesign, reducing failed renewals by 18%.
Cut p99 settlement latency from 1.4s to 320ms.

Page 1 of 2

Example Systems
Software Engineer
June 2019 - December 2021 (2 years 7 months)
Bengaluru, Karnataka, India
Built the reconciliation pipeline processing 2.3M transactions daily.

Education

Example Institute of Technology
Bachelor of Technology, Computer Science · (2015 - 2019)
`;

test("a LinkedIn export is detected before we try to parse it", () => {
  assert.equal(looksLikeLinkedinExport(EXPORT), true);
  // A plain resume must not be mistaken for one, or we would parse it with the
  // wrong rules and silently drop most of it.
  assert.equal(looksLikeLinkedinExport("Jane Doe\nSoftware Engineer\nExperience\nAcme Corp"), false);
});

test("LinkedIn import lifts identity, contact and headline", () => {
  const result = parseLinkedinProfile(EXPORT);
  assert.equal(result.name, "Priya Shah");
  assert.equal(result.content.headline, "Senior Software Engineer at Fictional Payments");
  assert.equal(result.content.contact?.email, "priya.shah@example.com");
  assert.match(result.content.contact?.linkedin ?? "", /linkedin\.com\/in\/priya-shah-4821/);
  assert.equal(result.content.contact?.location, "Bengaluru, Karnataka, India");
});

test("LinkedIn import reads every role with its dates and bullets", () => {
  const { content } = parseLinkedinProfile(EXPORT);
  assert.equal(content.experiences.length, 2);

  const [current, previous] = content.experiences;
  assert.equal(current.title, "Senior Software Engineer");
  assert.equal(current.company, "Fictional Payments Ltd");
  // The duration in parentheses is LinkedIn chrome, not part of the period.
  assert.equal(current.period, "January 2022 - Present");
  assert.equal(current.bullets.length, 2);
  assert.match(current.bullets[0], /failed renewals by 18%/);
  // The office location sits under the dates and is not a bullet.
  assert.ok(!current.bullets.some((b) => b.includes("Karnataka")), "location must not become a bullet");
  // Nor is the page footer.
  assert.ok(!current.bullets.some((b) => /page \d/i.test(b)), "page footers must be stripped");

  assert.equal(previous.company, "Example Systems");
  assert.equal(previous.period, "June 2019 - December 2021");
});

test("LinkedIn import reads education, skills, languages and awards", () => {
  const { content } = parseLinkedinProfile(EXPORT);
  assert.deepEqual(content.education, [
    { degree: "Bachelor of Technology, Computer Science", school: "Example Institute of Technology", year: "2015 - 2019", detail: undefined },
  ]);
  assert.deepEqual(content.skills, ["TypeScript", "PostgreSQL", "Kubernetes"]);
  assert.equal(content.languages.length, 2);
  assert.deepEqual(content.certifications, ["AWS Solutions Architect, Associate"]);
  assert.deepEqual(content.achievements, ["Internal engineering award, 2024"]);
  assert.match(content.summary, /^Backend engineer with seven years/);
});

// The product's whole claim is that it does not invent experience. An importer
// that fills gaps with plausible text would break that at the front door.
test("LinkedIn import invents nothing and reports what is missing", () => {
  const sparse = `
   Contact
   www.linkedin.com/in/sam-doe (LinkedIn)
   sam@example.com

Sam Doe
Warehouse Associate

Experience

Example Logistics
Warehouse Associate
2021 - Present
`;
  const result = parseLinkedinProfile(sparse);
  assert.equal(result.content.summary, "", "no summary in the export means no summary in the resume");
  assert.deepEqual(result.content.skills, []);
  assert.deepEqual(result.content.education, []);
  assert.deepEqual(result.content.projects, []);
  assert.equal(result.content.experiences.length, 1);
  assert.equal(result.content.experiences[0].bullets.length, 0, "no invented bullets");
  assert.ok(
    result.warnings.some((w) => /Summary/i.test(w)),
    "a missing summary must be surfaced, not silently empty",
  );
});

test("LinkedIn import survives an export with nothing recognisable", () => {
  const result = parseLinkedinProfile("just some text\nwith no structure at all");
  assert.equal(result.content.experiences.length, 0);
  assert.ok(result.warnings.length > 0);
});

import { resumeContentToFormFields, splitPeriod } from "../lib/resume-form/from-resume-content";
import { parseEducation, splitList, bulletLines } from "../lib/resume-form/parse";

test("an imported profile round-trips through the form serialisation", () => {
  const { name, content } = parseLinkedinProfile(EXPORT);
  const fields = resumeContentToFormFields(content, name);

  assert.equal(fields.name, "Priya Shah");
  assert.equal(fields.skills, "TypeScript, PostgreSQL, Kubernetes");

  // The form writes these strings and parse.ts reads them back on submit. If
  // the two ever disagree the user silently loses sections between import and
  // export, so assert the round trip rather than the format.
  assert.deepEqual(splitList(fields.skills), content.skills);
  assert.deepEqual(splitList(fields.languages), content.languages);
  // Certifications are newline-delimited, not comma-delimited, because one
  // credential carries its own comma: "AWS Solutions Architect, Associate" is a
  // single certification that splitList would return as two. The forms parse
  // this field with bulletLines for that reason.
  assert.deepEqual(bulletLines(fields.certifications), content.certifications);
  assert.deepEqual(bulletLines("AWS Solutions Architect, Associate"), ["AWS Solutions Architect, Associate"]);
  // Skills keep the aggressive split: "React, TypeScript" on one line is two.
  assert.deepEqual(splitList("AWS Solutions Architect, Associate"), ["AWS Solutions Architect", "Associate"]);
  // A single line still splits on commas, as the field placeholder promises.
  assert.deepEqual(splitList("AWS Cloud Practitioner, CPA"), ["AWS Cloud Practitioner", "CPA"]);
  assert.deepEqual(bulletLines(fields.achievements), content.achievements);

  const education = parseEducation(fields.education);
  assert.equal(education.length, 1);
  assert.equal(education[0].degree, "Bachelor of Technology, Computer Science");
  assert.equal(education[0].school, "Example Institute of Technology");
  assert.equal(education[0].year, "2015 - 2019");
});

test("a current role is flagged rather than given a fake end date", () => {
  assert.deepEqual(splitPeriod("January 2022 - Present"), { start: "January 2022", end: "", current: true });
  assert.deepEqual(splitPeriod("June 2019 - December 2021"), { start: "June 2019", end: "December 2021", current: false });
  assert.deepEqual(splitPeriod("2021"), { start: "2021", end: "", current: false });
  assert.deepEqual(splitPeriod(undefined), { start: "", end: "", current: false });
});

test("experience cards keep one empty bullet so the input still renders", () => {
  const fields = resumeContentToFormFields(
    { headline: "x", summary: "", skills: [], experiences: [{ title: "T", company: "C", period: "2020 - 2021", bullets: [] }], education: [], projects: [], certifications: [], languages: [], achievements: [] },
    "Sam",
  );
  assert.deepEqual(fields.experiences[0].bullets, [""]);
});

// Extraction tools render LinkedIn's middle dot as a bullet, a pipe, or a
// replacement character depending on font and encoding. A degree ending in
// stray punctuation would be printed onto the user's resume exactly like that.
test("education survives whatever the extractor does to the separator", () => {
  for (const separator of ["\u00b7", "\u2022", "|", "\ufffd"]) {
    const { content } = parseLinkedinProfile(`
   Contact
   www.linkedin.com/in/x (LinkedIn)

Test User
Engineer

Experience

Education

Example University
Bachelor of Science, Physics ${separator} (2015 - 2019)
`);
    assert.equal(content.education[0]?.degree, "Bachelor of Science, Physics", `separator ${JSON.stringify(separator)}`);
    assert.equal(content.education[0]?.year, "2015 - 2019");
  }
});
