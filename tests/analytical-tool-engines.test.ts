import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCoverLetter } from "../lib/cover-letter-analyzer";
import { checkLinkedinProfile } from "../lib/linkedin-checker";
import { matchResumeToJob } from "../lib/match-engine";
import { checkResume } from "../lib/resume-checker";

test("ATS checker flags verbatim job-description copying and non-resume documents", () => {
  const jd = `We are hiring a senior software engineer to build reliable cloud services using TypeScript, Node.js, PostgreSQL, AWS, Docker, Kubernetes, CI/CD, unit testing, scalable systems, distributed systems, API design, observability, security, code review, and cross-functional collaboration across a global platform with clear communication and strong problem solving.`;
  const copied = checkResume({
    resumeText: `Alex Doe | alex@example.com | +1 415 555 0101\nSummary\nSenior software engineer with cloud experience.\nSkills\nTypeScript, Node.js, PostgreSQL, AWS\nExperience\nSenior Engineer | Example Co | 2021-Present\n• Built an API used by 14 teams and improved reliability by 30%.\n${jd}\nEducation\nB.S. Computer Science 2020`,
    jdText: jd,
  });
  assert.ok(copied.checks.some((check) => check.id === "jd-copy"));

  const document = checkResume({ resumeText: "Chapter 4 System Architecture\nAbstract\nTable of contents\nArchitecture diagram and research methods." });
  assert.equal(document.checks.find((check) => check.id === "document-type")?.status, "fail");

  const bullet = "• Built a customer reporting dashboard used by 12 analysts.";
  const repeated = checkResume({
    resumeText: `Alex Doe | alex@example.com | +1 415 555 0101\nSummary\nSoftware engineer with reporting experience.\nSkills\nSQL, Python\nExperience\nEngineer | Example Co | 2021-Present\n${Array(6).fill(bullet).join("\n")}\nEducation\nB.S. Computer Science 2020`,
  });
  assert.ok(repeated.checks.some((check) => check.id === "duplicate-bullets"));
});

test("resume match separates relevant experience from a cross-domain resume", () => {
  const jd = `Senior Software Engineer. Build software services with TypeScript, React, PostgreSQL, AWS, Docker, Kubernetes, CI/CD, and automated testing. Own API design, system reliability, performance, and code review. Work with product and design teams to ship scalable customer-facing applications.`;
  const technical = `Software Engineer with experience building software services in TypeScript, React, PostgreSQL, AWS, Docker, Kubernetes, and CI/CD. Designed API systems and automated testing; improved reliability and performance for customer-facing applications. Led code reviews and partnered with product and design teams.`;
  const marketing = `Marketing Manager with experience planning campaigns, creating social media content, managing brand partnerships, email marketing, search engine optimization, and event promotion. Increased audience engagement through editorial calendars and campaign reporting.`;

  const relevant = matchResumeToJob(technical, jd);
  const mismatch = matchResumeToJob(marketing, jd);
  assert.ok(relevant.fitScore > mismatch.fitScore);
  assert.ok(relevant.matched.length > mismatch.matched.length);
  assert.equal(relevant.counts.jdTerms, relevant.counts.matched + relevant.counts.missing);
});

const letter = `Dear Ms Chen,\n\nI am applying for the Senior Data Analyst role. In my current position, I reconciled reporting across several teams and built a weekly dashboard that reduced review time by 30%. I am interested in this opportunity because the work described aligns with my experience improving data quality and helping finance partners make clearer decisions. I would welcome the chance to discuss how I can contribute.\n\nSincerely,\nAlex Rivera`;

test("cover letter analyzer does not mistake a role or prior-employer-style phrase for the target company", () => {
  const result = analyzeCoverLetter(letter);
  assert.equal(result.checks.find((check) => check.label === "Target company mentioned")?.pass, false);
  assert.equal(result.checks.find((check) => check.label === "Target role in opening")?.pass, false);
});

test("cover letter analyzer verifies the exact company and role supplied by the user", () => {
  const result = analyzeCoverLetter(letter, { company: "Fictional Payments", role: "Senior Data Analyst" });
  assert.equal(result.checks.find((check) => check.label === "Target company mentioned")?.pass, false);
  assert.equal(result.checks.find((check) => check.label === "Target role in opening")?.pass, true);

  const tailored = letter.replace("I am applying for the Senior Data Analyst role.", "I am applying for the Senior Data Analyst role at Fictional Payments.");
  const tailoredResult = analyzeCoverLetter(tailored, { company: "Fictional Payments", role: "Senior Data Analyst" });
  assert.equal(tailoredResult.checks.find((check) => check.label === "Target company mentioned")?.pass, true);
  assert.equal(tailoredResult.checks.find((check) => check.label === "Target role in opening")?.pass, true);

  const nearMatch = tailored.replace("Fictional Payments", "Fictional Payments Group");
  assert.equal(analyzeCoverLetter(nearMatch, { company: "Fictional Payments" }).checks.find((check) => check.label === "Target company mentioned")?.pass, true);
  assert.equal(analyzeCoverLetter(tailored.replace("Fictional Payments", "NotFictional Payments"), { company: "Fictional" }).checks.find((check) => check.label === "Target company mentioned")?.pass, false);
});

const linkedin = (bullet: string) => `Senior Data Analyst | SQL, Python, Tableau\n\nAbout\nI am a data analyst focused on reliable reporting and clear decision support. I build trusted relationships with finance, operations, and product teams, translating business questions into thoughtful analysis and useful dashboards. I have worked across recurring reporting, data quality, and process improvement, and I enjoy explaining technical findings in plain language.\n\nExperience\n${bullet}\n\nSkills\nSQL, Python, Tableau, Excel, Data Analysis\n\nFeatured\nPortfolio and selected reporting projects`;

test("LinkedIn scoring counts explicit quantities as metrics, not impact verbs alone", () => {
  const unquantified = checkLinkedinProfile({ profileText: linkedin("Improved team reporting through clear stakeholder communication.") });
  const quantified = checkLinkedinProfile({ profileText: linkedin("Improved team reporting turnaround by 30% across 12 monthly dashboards.") });
  assert.equal(unquantified.detected.metricBullets, 0);
  assert.equal(quantified.detected.metricBullets, 1);
  assert.ok(quantified.score > unquantified.score);
});
