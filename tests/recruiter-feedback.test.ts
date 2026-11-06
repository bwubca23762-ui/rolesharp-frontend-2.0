import test from "node:test";
import assert from "node:assert/strict";
import { checkResume } from "../lib/resume-checker";
import { recruiterFeedback } from "../lib/recruiter-feedback";

const RESUME = `Priya Raman
Senior Data Analyst | priya.raman@example.com | +91 98765 43210 | Bengaluru, India
https://www.linkedin.com/in/priya-raman

Professional Summary
Data analyst working on billing and revenue reporting.

Skills
SQL | Python | Tableau | Excel | reconciliation

Experience
Senior Data Analyst | Fictional Payments | 2022 - Present
• Cut monthly reconciliation time from 6 days to 2 days across 14 merchant accounts
• Responsible for the weekly revenue dashboard used by the finance team
• Built a churn model that flagged accounts for the retention team

Education
B.Sc Statistics | Example University | 2019
`;

function feedbackFor(text: string, jdText?: string) {
  const result = checkResume({ resumeText: text, jdText });
  return { result, feedback: recruiterFeedback(text, result) };
}

/** Whitespace-normalised haystack, matching how quotes are normalised. */
function flat(text: string) {
  return text.replace(/\s+/g, " ");
}

test("every quoted note points at a line that is really in the resume", () => {
  const { feedback } = feedbackFor(RESUME);
  const hay = flat(RESUME);
  assert.ok(feedback.notes.length > 0);
  for (const note of feedback.notes) {
    if (!note.quote) continue;
    // Truncated quotes keep their prefix verbatim; the ellipsis is ours.
    const verbatim = note.quote.replace(/…$/, "");
    assert.ok(hay.includes(verbatim), `invented quote: ${note.quote}`);
  }
});

test("the strongest quantified bullet is what the recruiter says they slowed down on", () => {
  const { feedback } = feedbackFor(RESUME);
  const strength = feedback.notes.find((note) => note.kind === "strength" && note.quote);
  assert.match(strength?.quote ?? "", /from 6 days to 2 days/);
});

test("a weak opener is called out by quoting it, not by scolding in the abstract", () => {
  const { feedback } = feedbackFor(RESUME);
  const concern = feedback.notes.find((note) => note.kind === "concern" && /Responsible for/i.test(note.quote ?? ""));
  assert.ok(concern, "expected the 'Responsible for' bullet to be quoted back");
});

test("a gap is asked about, never asserted as a fact about the person", () => {
  const { feedback } = feedbackFor(RESUME, "We need Kubernetes and Terraform for this platform role.");
  const questions = feedback.notes.filter((note) => note.kind === "question");
  assert.ok(questions.length > 0);
  for (const question of questions) {
    assert.match(question.point, /\?/, `a gap note must be a question: ${question.point}`);
  }
  // No note may claim the candidate lacks something.
  for (const note of feedback.notes) {
    assert.doesNotMatch(note.point, /\byou (?:lack|have no|do not have|don't have)\b/i, note.point);
  }
});

test("the unquantified bullet is the one the screening question is attached to", () => {
  const { feedback } = feedbackFor(RESUME);
  const asked = feedback.notes.filter((note) => note.kind === "question" && note.quote);
  assert.ok(asked.length > 0);
  for (const note of asked) {
    assert.ok(!/\d/.test(note.quote ?? ""), `asked for a number on a bullet that already has one: ${note.quote}`);
  }
});

test("no resume line is read back to the candidate more than once", () => {
  const { feedback } = feedbackFor(RESUME);
  const quotes = feedback.notes.map((note) => note.quote).filter(Boolean);
  assert.equal(new Set(quotes).size, quotes.length, `repeated a line: ${quotes.join(" | ")}`);
});

test("gaps skip posting framing and anything the resume already answers", () => {
  const posting = "You will own reporting and partner with finance. We need a strong track record with dashboards, forecasting, and Kubernetes. Experience required.";
  const { result, feedback } = feedbackFor(RESUME, posting);
  const asked = feedback.notes.filter((note) => note.kind === "question" && !note.quote).map((note) => note.point);

  // The resume says "dashboard"; the score counts "dashboards" as missing, and
  // it is right to, but asking about it reads as not having read the resume.
  assert.ok(result.missingKeywords.includes("dashboards"), "precondition: the score still counts it missing");
  assert.ok(!asked.some((point) => /"dashboards"/.test(point)), "asked about a skill the resume already shows");
  for (const noise of ["track", "record", "experience", "strong", "own", "partner"]) {
    assert.ok(!asked.some((point) => point.includes(`"${noise}"`)), `${noise} is posting framing, not a requirement`);
  }
  assert.ok(asked.some((point) => /"kubernetes"/.test(point)), "a real unmet requirement should still be asked about");
});

test("employment dates are not mistaken for a phone number", () => {
  const noPhone = RESUME.replace(" | +91 98765 43210", "");
  assert.equal(checkResume({ resumeText: noPhone }).detected.phone, false);
  assert.equal(checkResume({ resumeText: RESUME }).detected.phone, true);
});

test("the first impression reports what is actually there", () => {
  const { feedback } = feedbackFor(RESUME);
  assert.match(feedback.firstImpression, /Priya Raman/);
  assert.match(feedback.firstImpression, /\d+ of \d+ bullets with a number/);
});

test("a document that is not a resume gets no recruiter read at all", () => {
  const chapter = `Chapter 4 System Architecture
The three-layer architecture separates the presentation layer from the application layer.
Data flow diagram DFD Level 1 describes request processing and session management.
The SQLite database schema follows database normalization to third normal form.
Figure 3 shows the entity-relationship diagram for the route handling module.`;
  const { feedback } = feedbackFor(chapter);
  assert.match(feedback.firstImpression, /could not review this as a resume/i);
  assert.deepEqual(feedback.notes, []);
});

test("missing contact details are raised without a quote, since no line can be cited", () => {
  const noPhone = RESUME.replace(" | +91 98765 43210", "");
  const { feedback } = feedbackFor(noPhone);
  const note = feedback.notes.find((n) => /no phone number/i.test(n.point));
  assert.ok(note, "expected the missing phone to be raised");
  assert.equal(note?.quote, undefined);
});
