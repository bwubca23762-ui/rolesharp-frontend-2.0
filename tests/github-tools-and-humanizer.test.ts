import assert from "node:assert/strict";
import test from "node:test";

import {
  burstinessIndex,
  humanizeResumeContent,
  humanizeResumeText,
  scoreHumanAuthenticity,
} from "../lib/ai-humanizer";
import {
  compileStructuredResumeToAtsText,
  exportToJsonResume,
  exportToRenderCvYaml,
  importFromJsonResume,
} from "../lib/json-resume-bridge";
import {
  analyzeAtsXrayAndFrequency,
  parseResumeLines,
  tfidfCosineSimilarity,
} from "../lib/ats-xray-parser";
import { ResumeContent } from "../lib/types";

// The 7-tool batch: the de-AI engine (Tool 7), the open-standard bridge
// (Tools 4–6), and the parser X-Ray + frequency matrix (Tools 2–3). These
// pins hold the two contracts that matter across all of them: nothing is
// invented, and nothing the Zero-Fabrication rule protects — numbers,
// technical keywords — is ever edited by a pass.

// ── Tool 7: the de-AI engine ─────────────────────────────────────────────────

test("pass 1 strips invisible watermarks and non-breaking spaces", () => {
  const dirty = "Led\u200B the platform team\u00A0across\u2060 three regions.";
  const result = humanizeResumeText(dirty);
  assert.ok(!/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u2060\u00A0]/.test(result.text));
  assert.ok(result.counts.watermarks >= 3);
});

test("pass 1 keeps a single em-dash but collapses the LLM cluster", () => {
  const single = humanizeResumeText("Built the ledger — a migration, not a rewrite.").text;
  assert.match(single, /—/);
  const clustered = humanizeResumeText("Built X — shipped Y — cut Z.").text;
  assert.ok(!/—/.test(clustered));
  assert.match(clustered, /,/);
});

test("pass 2 rewrites AI cliché verbs with case preserved, keywords untouched", () => {
  const result = humanizeResumeText("Spearheaded the migration and utilized Kubernetes and SQL.");
  assert.match(result.text, /^Led the migration/);
  assert.match(result.text, /used Kubernetes and SQL/);
  assert.equal(result.counts.cliches >= 2, true);
});

test("pass 2 strips the empty adverbs and keeps the sentence capitalized", () => {
  assert.match(humanizeResumeText("Successfully launched the billing API.").text, /^Launched the billing API\.$/);
});

test("pass 3 drops the robotic tail when it carries no fact, keeps it when it does", () => {
  const dropped = humanizeResumeText("Ran the migration, fostering a culture of experimentation.");
  assert.ok(!/fostering/.test(dropped.text));
  assert.equal(dropped.counts.tails, 1);
  const kept = humanizeResumeText("Automated deploys, ensuring 99.9% uptime across regions.");
  assert.match(kept.text, /while ensuring 99\.9% uptime/);
  assert.equal(kept.counts.tails, 0);
});

test("pass 4 rotates repeated consecutive bullet openings", () => {
  const result = humanizeResumeText("- Led the payments team.\n- Led the billing migration.\n- Led three interns.");
  const lines = result.text.split("\n");
  assert.match(lines[0], /^- Led /);
  assert.match(lines[1], /^- Guided /);
  assert.ok(result.counts.rotatedOpenings >= 2);
});

test("pass 5 scores AI-heavy text below clean human text", () => {
  const aiHeavy = [
    "Dynamic and results-driven professional passionate about leveraging cutting-edge solutions.",
    "- Spearheaded the holistic rebranding initiative, ensuring seamless cross-channel alignment.",
    "- Utilized data-driven insights to meticulously orchestrate campaigns, driving significant growth.",
    "- Leveraged state-of-the-art automation tools, fostering a culture of experimentation.",
    "- Orchestrated the synergies between myriad multifaceted teams, showcasing pivotal impact.",
  ].join("\n");
  const human = [
    "Backend engineer, eight years on payments.",
    "- Cut checkout latency 38% for 12M monthly requests.",
    "- Led the ledger migration to Postgres; reconciliation now runs in minutes instead of hours.",
    "Wrote the runbooks.",
    "On-call one week in six.",
  ].join("\n");
  const aiScore = scoreHumanAuthenticity(aiHeavy);
  const humanScore = scoreHumanAuthenticity(human);
  assert.ok(aiScore.humanScore < humanScore.humanScore, `${aiScore.humanScore} should be below ${humanScore.humanScore}`);
  assert.ok(aiScore.aiRisk > humanScore.aiRisk);
  assert.ok(aiScore.humanScore >= 0 && aiScore.humanScore <= 100);
  assert.ok(burstinessIndex(human) > 0);
});

test("humanizeResumeContent cleans prose fields and never touches contact or skills", () => {
  const content = ResumeContent.parse({
    headline: "QA Engineer",
    contact: { email: "ravi@example.com", phone: "+91 98765 43210" },
    summary: "Results-driven engineer who spearheaded automation.",
    skills: ["Selenium", "SQL", "API testing"],
    experiences: [{
      title: "QA Engineer", company: "Acme", period: "2023—2026",
      bullets: ["Utilized Selenium to cut regression time 40%.", "Filed 300+ verified bug reports."],
    }],
    education: [{ degree: "BSc Computer Science", school: "ABC University", year: "2023" }],
  });
  const { content: cleaned, counts } = humanizeResumeContent(content);
  assert.match(cleaned.summary, /Outcome-focused engineer who led automation/);
  assert.match(cleaned.experiences[0].bullets[0], /^Used Selenium to cut regression time 40%\.$/);
  assert.deepEqual(cleaned.skills, content.skills);
  assert.deepEqual(cleaned.contact, content.contact);
  assert.deepEqual(cleaned.education, content.education);
  assert.ok(counts.cliches >= 3);
});

// ── Tools 4–6: the open-standard bridge ──────────────────────────────────────

const STANDARD_RESUME_JSON = {
  basics: {
    name: "Ravi Kumar",
    label: "QA Engineer",
    email: "ravi@example.com",
    phone: "+91 98765 43210",
    summary: "Detail-focused QA engineer with three years in web application testing.",
    location: { city: "Bengaluru" },
    profiles: [{ network: "LinkedIn", url: "https://linkedin.com/in/ravi" }],
  },
  work: [{
    position: "QA Engineer",
    name: "Acme",
    startDate: "2023-01-01",
    endDate: "2026-05-01",
    highlights: ["Cut regression time 40% by automating smoke suites."],
  }],
  education: [{ institution: "ABC University", studyType: "BSc", area: "Computer Science", endDate: "2023" }],
  skills: [{ name: "Selenium", level: "Advanced", keywords: ["Automation"] }],
  projects: [{ name: "TestKit", description: "Open-source test toolkit." }],
  certificates: [{ name: "ISTQB Foundation" }],
  languages: [{ language: "English", fluency: "Native" }],
  awards: [{ title: "Hack winner", summary: "Built in 48 hours" }],
  volunteer: [{ position: "Mentor", organization: "CodeClub", startDate: "2022-01-01", endDate: "2023-01-01" }],
};

test("importFromJsonResume maps the standard schema into structured content", () => {
  const { content, warnings } = importFromJsonResume(STANDARD_RESUME_JSON);
  assert.equal(content.headline, "QA Engineer");
  assert.equal(content.summary, STANDARD_RESUME_JSON.basics.summary);
  assert.equal(content.contact?.email, "ravi@example.com");
  assert.equal(content.contact?.linkedin, "https://linkedin.com/in/ravi");
  assert.equal(content.experiences.length, 2); // work + volunteer
  assert.equal(content.experiences[0].company, "Acme");
  assert.match(content.experiences[0].period ?? "", /2023-01-01/);
  assert.match(content.experiences[0].bullets[0], /regression time 40%/);
  assert.equal(content.education[0].degree, "BSc, Computer Science");
  assert.equal(content.education[0].school, "ABC University");
  assert.ok(content.skills.includes("Selenium"));
  assert.ok(content.skills.includes("Automation")); // keywords folded in
  assert.equal(content.projects[0].name, "TestKit");
  assert.deepEqual(content.certifications, ["ISTQB Foundation"]);
  assert.deepEqual(content.languages, ["English"]);
  assert.match(content.achievements[0], /Hack winner — Built in 48 hours/);
  assert.deepEqual(warnings, []);
});

test("importFromJsonResume handles the Reactive Resume export shape", () => {
  const reactive = {
    basics: { name: "Maya Lin", headline: "Data Scientist", email: "maya@example.edu" },
    sections: {
      work: { items: [{ position: "Fellow", company: "Example Institute", summary: "Built pipelines processing 4.5 TB." }] },
      skills: { items: [{ name: "Python" }, { name: "PyTorch" }] },
    },
  };
  const { content } = importFromJsonResume(reactive);
  assert.equal(content.headline, "Data Scientist");
  assert.equal(content.experiences[0].company, "Example Institute");
  assert.match(content.experiences[0].bullets[0], /4\.5 TB/);
  assert.deepEqual(content.skills, ["Python", "PyTorch"]);
});

test("export → import round-trips the core facts", () => {
  const content = ResumeContent.parse({
    headline: "QA Engineer",
    contact: { email: "ravi@example.com", linkedin: "https://linkedin.com/in/ravi" },
    summary: "Detail-focused QA engineer.",
    skills: ["Selenium", "SQL"],
    experiences: [{ title: "QA Engineer", company: "Acme", period: "2023-01-01 - Present", bullets: ["Cut regression time 40%."] }],
    education: [{ degree: "BSc Computer Science", school: "ABC University", year: "2023" }],
    projects: [],
    certifications: [],
    languages: [],
    achievements: [],
  });
  const exported = exportToJsonResume(content, "Ravi Kumar");
  assert.equal(exported.basics.name, "Ravi Kumar");
  assert.equal(exported.basics.label, "QA Engineer");
  assert.equal(exported.work?.[0].position, "QA Engineer");
  assert.equal(exported.work?.[0].name, "Acme");
  assert.equal(exported.work?.[0].endDate, undefined); // "Present" stays open-ended
  assert.equal(exported.work?.[0].highlights?.[0], "Cut regression time 40%.");
  const { content: reimported } = importFromJsonResume(exported);
  assert.equal(reimported.experiences[0].title, "QA Engineer");
  assert.equal(reimported.experiences[0].company, "Acme");
  assert.equal(reimported.experiences[0].bullets[0], "Cut regression time 40%.");
});

test("exportToRenderCvYaml emits a Git-committable classic RenderCV document", () => {
  const content = ResumeContent.parse({
    headline: "QA Engineer",
    summary: "Detail-focused QA engineer.\nThree years in web testing.",
    skills: ["Selenium", "SQL"],
    experiences: [{ title: "QA Engineer", company: "Acme", period: "2023-01 - 2026-05", bullets: ["Cut regression time 40%."] }],
    education: [{ degree: "BSc Computer Science", school: "ABC University", year: "2023" }],
    projects: [{ name: "TestKit", detail: "Open-source test toolkit." }],
    certifications: ["ISTQB Foundation"],
    languages: ["English"],
    achievements: ["Hack winner"],
    contact: {},
  });
  const yaml = exportToRenderCvYaml(content, "Ravi Kumar");
  assert.match(yaml, /# Generated by RoleSharp/);
  assert.match(yaml, /design:\n  theme: classic/);
  assert.match(yaml, /cv:\n  name: "Ravi Kumar"/);
  assert.match(yaml, /Experience:\n      - company: "Acme"\n        position: "QA Engineer"\n        startDate: "2023-01"\n        endDate: "2026-05"/);
  assert.match(yaml, /highlights:\n          - "Cut regression time 40%\."/,);
  assert.match(yaml, /Summary:\n      - text: \|-\n\s+Detail-focused QA engineer\./);
  assert.match(yaml, /Skills:\n      - text: "Selenium, SQL"/);
  assert.match(yaml, /Achievements:\n      - bullet: "Hack winner"/);
  // Dates keep the precision the source had — a year stays a year.
  assert.match(yaml, /endDate: "2023"/);
});

test("compileStructuredResumeToAtsText flattens every section the scorers read", () => {
  const content = ResumeContent.parse({
    headline: "QA Engineer",
    contact: { email: "ravi@example.com" },
    summary: "Detail-focused QA engineer.",
    skills: ["Selenium", "SQL"],
    experiences: [{ title: "QA Engineer", company: "Acme", period: "2023—2026", bullets: ["Cut regression time 40%."] }],
    education: [],
    projects: [{ name: "TestKit", detail: "Toolkit." }],
    certifications: [],
    languages: [],
    achievements: [],
  });
  const text = compileStructuredResumeToAtsText(content);
  assert.match(text, /QA Engineer/);
  assert.match(text, /ravi@example\.com/);
  assert.match(text, /Cut regression time 40%\./);
  assert.match(text, /Selenium/);
  assert.match(text, /TestKit/);
});

// ── Tools 2–3: the parser X-Ray & frequency matrix ───────────────────────────

const XRAY_RESUME = `JORDAN AVERY
jordan@example.com | +1 415 555 0101
SUMMARY
Backend engineer, eight years on payments systems.

EXPERIENCE
- Led the billing platform for 3 years.
2019 - 2021 Managed the payments migration across three regions
TECHNICAL ARSENAL
Go | Python | Postgres

EDUCATION
BSc Computer Science, Example University, 2016
June 2020`;

test("parseResumeLines classifies sections and flags the four reading-order failures", () => {
  const lines = parseResumeLines(XRAY_RESUME);
  const byText = (needle: string) => lines.find((l) => l.extractedText.includes(needle));

  assert.equal(byText("SUMMARY")?.detectedSection, "summary");
  assert.equal(byText("EXPERIENCE")?.detectedSection, "experience");
  assert.equal(byText("JORDAN AVERY")?.detectedSection, "contact");

  const collision = byText("2019 - 2021 Managed the payments migration");
  assert.equal(collision?.readingOrderStatus, "multi_column_collision");

  const tableTrap = byText("Go | Python | Postgres");
  assert.equal(tableTrap?.readingOrderStatus, "table_trap");

  const unknownHeader = byText("TECHNICAL ARSENAL");
  assert.equal(unknownHeader?.readingOrderStatus, "unparsed_header");
  assert.equal(unknownHeader?.detectedSection, "header");

  const detachedDate = byText("June 2020");
  assert.equal(detachedDate?.readingOrderStatus, "date_warning");

  assert.equal(byText("Led the billing platform")?.readingOrderStatus, "clean");
});

test("the X-Ray report answers five vendors and extracts the five key sections", () => {
  const report = analyzeAtsXrayAndFrequency(XRAY_RESUME);
  assert.equal(report.vendors.vendors.length, 5);
  for (const vendor of report.vendors.vendors) {
    assert.ok(["pass", "warn", "fail"].includes(vendor.verdict), `${vendor.vendor} verdict`);
  }
  const names = report.sections.map((s) => s.section);
  assert.deepEqual(names, ["Contact", "Summary", "Experience", "Education", "Skills"]);
  const experience = report.sections.find((s) => s.section === "Experience");
  assert.ok(experience?.found);
  assert.ok(experience.lineCount >= 3);
});

test("the TF-IDF matrix counts both sides and templates every missing term", () => {
  const jd = `Staff Backend Engineer

Requirements:
- 8+ years building backend systems in Go or Python
- Deep Kubernetes experience in production. Kubernetes, Kubernetes, Kubernetes.
- Strong Postgres performance tuning skills
- Experience leading teams across API platforms`;
  const report = analyzeAtsXrayAndFrequency(XRAY_RESUME, jd);

  assert.ok(report.similarity);
  assert.ok(report.similarity!.score >= 0 && report.similarity!.score <= 100);

  const kubernetes = report.matrix.find((row) => row.term === "kubernetes");
  assert.ok(kubernetes, "kubernetes row");
  assert.equal(kubernetes.category, "must_have");
  assert.equal(kubernetes.jdFrequencyCount, 4);
  assert.equal(kubernetes.resumeFrequencyCount, 0);
  assert.equal(kubernetes.status, "missing");
  assert.match(kubernetes.suggestedBulletTemplate ?? "", /\[X%\]/);

  const postgres = report.matrix.find((row) => row.term === "postgresql");
  assert.ok(postgres, "postgresql row (canonicalized from Postgres)");
  assert.equal(postgres.resumeFrequencyCount, 1);
  assert.equal(postgres.status, "matched");

  assert.equal(report.stats.missing >= 1, true);
  assert.equal(report.stats.matched >= 1, true);
});

test("tf-idf cosine is 100 for identical documents and 0 for disjoint ones", () => {
  assert.equal(tfidfCosineSimilarity("lead engineer kubernetes postgres", "lead engineer kubernetes postgres"), 100);
  assert.equal(tfidfCosineSimilarity("kubernetes deployments", "basketball schedules"), 0);
});
