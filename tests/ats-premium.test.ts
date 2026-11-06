import test from "node:test";
import assert from "node:assert/strict";
import { checkResumeContent } from "../lib/resume-checker";
import { atsScore, keywordCoverage } from "../lib/ats-score";
import { localTailor } from "../lib/local-tailor";
import { FREE_ATS_TARGET, PREMIUM_ATS_TARGET } from "../lib/ats-targets";
import type { GenerateRequest, ResumeContent } from "../lib/types";

// ---------------------------------------------------------------------------
// Premium 99+ upgrade verification.
// 1. A fully-optimized resume (complete contact, high JD coverage, metric-led
//    action bullets) must be able to score 99+ — no mechanical ceiling.
// 2. A weak resume must stay clearly below premium territory.
// 3. The live builder meter (ats-score) and the engine scorer (resume-checker)
//    must agree — they are the same scorer now.
// 4. Premium localTailor must surface user impact facts on metric-less bullets.
// ---------------------------------------------------------------------------

const JD = `We are hiring a Frontend Engineer to build customer-facing products.
Requirements: React, TypeScript, Next.js, Node.js, GraphQL, REST API design,
CI/CD pipelines, AWS, accessibility, performance optimization, unit testing,
cross-functional collaboration, communication, leadership, mentoring, agile.`;

const strongResume: ResumeContent = {
  headline: "Frontend Engineer — React, TypeScript — Acme",
  contact: {
    email: "jane@example.com",
    phone: "+1 415 555 0100",
    location: "San Francisco, United States",
    linkedin: "https://linkedin.com/in/janedoe",
  },
  summary:
    "Frontend Engineer with 6 years of experience building accessible, high-performance React and TypeScript applications. Shipped customer-facing products on Next.js and Node.js with GraphQL and REST API layers, CI/CD pipelines on AWS, and strong unit testing discipline. Known for cross-functional collaboration, clear communication, leadership, and mentoring across agile teams.",
  skills: [
    "React", "TypeScript", "Next.js", "Node.js", "GraphQL", "REST API", "CI/CD",
    "AWS", "Accessibility", "Performance Optimization", "Unit Testing", "Agile",
    "Cross-functional Collaboration", "Communication", "Leadership", "Mentoring",
  ],
  experiences: [
    {
      title: "Senior Frontend Engineer",
      company: "Acme Corp",
      period: "Jan 2021 - Present",
      bullets: [
        "Led migration of a customer-facing React platform to TypeScript and Next.js, improving page performance scores from 61 to 94 and reducing bundle size 38%.",
        "Built GraphQL and REST API integration layers in Node.js serving 2.4M monthly users with 99.9% uptime across production environments.",
        "Implemented CI/CD pipelines on AWS that cut release time from 4 hours to 20 minutes for a cross-functional team of 12 engineers.",
        "Improved accessibility to WCAG 2.1 AA across 40+ screens, increasing conversion for assistive-technology users by 18%.",
      ],
    },
    {
      title: "Frontend Engineer",
      company: "Beta Labs",
      period: "Jun 2018 - Dec 2020",
      bullets: [
        "Developed unit testing infrastructure reaching 92% coverage, reducing production regressions by 45% in the first quarter.",
        "Mentored 5 junior engineers on React performance optimization and agile delivery practices, with all 5 promoted within 18 months.",
        "Shipped a component library with accessibility baked in, adopted across 7 product teams and cutting duplicate frontend work by 30%.",
      ],
    },
  ],
  education: [
    { degree: "B.S. Computer Science", school: "State University", year: "2018", detail: "Graduated with honors, human-computer interaction focus." },
  ],
  projects: [
    { name: "OpenDash", detail: "Built an open-source React and TypeScript dashboard with GraphQL subscriptions and automated CI/CD releases, adopted by 3,000+ developers." },
  ],
  certifications: ["AWS Certified Developer – Associate"],
  languages: ["English", "Spanish"],
  achievements: ["Speaker, React Conf community track 2024"],
};

const weakResume: ResumeContent = {
  headline: "Job Seeker",
  contact: { email: "a@b.com" },
  summary: "Looking for a job.",
  skills: ["Microsoft Word"],
  experiences: [
    {
      title: "Worker",
      company: "Company",
      period: "",
      bullets: ["Responsible for various tasks.", "Worked on things as assigned."],
    },
  ],
  education: [],
  projects: [],
  certifications: [],
  languages: [],
  achievements: [],
};

test("fully-optimized premium resume can reach 99+", () => {
  const result = checkResumeContent(strongResume, {
    jdText: JD,
    targetRole: "Frontend Engineer",
    targetCompany: "Acme",
  });
  assert.ok(
    result.score >= 99,
    `expected 99+, got ${result.score} — breakdown: ${result.breakdown.map((b) => `${b.label} ${b.score}/${b.max}`).join(", ")}`,
  );
});

test("premium generation baseline reaches 95+ with complete factual evidence", () => {
  const req = {
    profile: {
      name: "Jane Doe",
      email: strongResume.contact?.email,
      phone: strongResume.contact?.phone,
      country: "United States",
      location: "San Francisco",
      linkedin: strongResume.contact?.linkedin,
      links: [],
      summary: strongResume.summary,
      skills: strongResume.skills,
      experiences: strongResume.experiences.map((experience) => ({
        title: experience.title,
        company: experience.company,
        start: experience.period?.split(" - ")[0],
        end: experience.period?.split(" - ")[1],
        bullets: experience.bullets,
      })),
      education: strongResume.education,
      projects: strongResume.projects,
      certifications: strongResume.certifications,
      languages: strongResume.languages,
      achievements: strongResume.achievements,
    },
    roleTitleRaw: "Frontend Engineer",
    companyNameRaw: "Acme",
    jdText: JD,
    template: "executive",
  } as unknown as GenerateRequest;

  const result = localTailor(req, null, "Acme", true);
  assert.ok(result.atsScore >= 95, `expected premium factual baseline >=95, got ${result.atsScore}`);
});

test("AI generation targets remain 85 for free and 99 for premium", () => {
  assert.equal(FREE_ATS_TARGET, 85);
  assert.equal(PREMIUM_ATS_TARGET, 99);
});

test("weak resume stays far below premium territory", () => {
  const result = checkResumeContent(weakResume, { jdText: JD, targetRole: "Frontend Engineer" });
  assert.ok(result.score < 70, `expected <70, got ${result.score}`);
});

test("keyword matching uses full tokens instead of substrings", () => {
  const result = checkResumeContent(strongResume, {
    roleSkills: ["Java", "React"],
    preferredRoleSkills: ["Software as a Service"],
  });
  const required = result.keywordGroups.find((group) => group.label === "Role-required skills");
  const preferred = result.keywordGroups.find((group) => group.label === "Role-preferred skills");
  assert.deepEqual(required?.found, ["react"]);
  assert.deepEqual(required?.missing, ["java"], "JavaScript must not satisfy Java");
  assert.deepEqual(preferred?.missing, ["software as a service"]);
});

test("keyword matching accepts conservative acronym aliases", () => {
  const content = { ...strongResume, skills: [...strongResume.skills, "SaaS"] };
  const result = checkResumeContent(content, { roleSkills: ["Software as a Service"] });
  const required = result.keywordGroups.find((group) => group.label === "Role-required skills");
  assert.deepEqual(required?.found, ["software as a service"]);
});

test("live keyword diagnostics do not confuse Java with JavaScript", () => {
  assert.equal(keywordCoverage("Java", "JavaScript TypeScript"), 0);
  assert.equal(keywordCoverage("Java", "Built services with Java and Spring"), 1);
});

test("half of substantive bullets quantified earns full impact credit", () => {
  const balanced: ResumeContent = {
    ...strongResume,
    experiences: [{
      title: "Frontend Engineer",
      company: "Acme Corp",
      period: "2021 - Present",
      bullets: [
        "Improved React page performance by 38% across the customer platform.",
        "Built TypeScript components used by 12 cross-functional product teams.",
        "Reduced CI/CD release time from 4 hours to 20 minutes on AWS.",
        "Led accessibility reviews and remediated WCAG issues across core journeys.",
        "Developed GraphQL and REST API integrations for customer-facing products.",
        "Mentored frontend engineers on unit testing and performance optimization.",
      ],
    }],
  };
  const result = checkResumeContent(balanced, { jdText: JD, targetRole: "Frontend Engineer" });
  assert.equal(result.breakdown.find((part) => part.label === "Impact")?.score, 20);
});

test("live builder meter agrees with the engine scorer", () => {
  // Both sides now receive the same context (target role + candidate skills)
  // — the meter passes it from the builder form, the engine passes it from
  // the generation request. Equal inputs must produce equal scores.
  const options = { targetRole: "Frontend Engineer", roleSkills: strongResume.skills };
  const meter = atsScore(JD, strongResume, options);
  const engine = checkResumeContent(strongResume, { jdText: JD, targetRole: "Frontend Engineer", roleSkills: strongResume.skills }).score;
  assert.equal(meter, engine);
});

test("premium localTailor surfaces impact facts on metric-less bullets", () => {
  const req = {
    profile: {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+1 415 555 0100",
      country: "United States",
      location: "San Francisco",
      linkedin: "https://linkedin.com/in/janedoe",
      links: [],
      summary: "Frontend engineer.",
      skills: ["React", "TypeScript"],
      experiences: [
        {
          title: "Frontend Engineer",
          company: "Acme",
          start: "2021",
          end: "Present",
          bullets: ["Improved the checkout flow for customers."],
          impactFacts: { metric: "18% conversion lift", scope: "2M users", outcome: "faster checkout", timeframe: "6 months" },
        },
      ],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
      achievements: [],
    },
    roleTitleRaw: "Frontend Engineer",
    jdText: JD,
    template: "basic",
  } as unknown as GenerateRequest;

  const premium = localTailor(req, null, "Acme", true);
  const bullet = premium.content.experiences[0].bullets[0];
  assert.ok(bullet.includes("18% conversion lift"), `impact facts missing from: ${bullet}`);
  assert.ok(bullet.length <= 198, `premium bullet should stay readable, got ${bullet.length} characters`);

  const free = localTailor(req, null, "Acme", false);
  const freeBullet = free.content.experiences[0].bullets[0];
  assert.match(freeBullet, /^Improved\b/, "free fallback should preserve an existing action-led bullet");
  assert.ok(!freeBullet.includes("18% conversion lift"), "free tier should not get the premium impact-facts append");
});

test("free fallback strengthens passive wording without inventing metrics", () => {
  const req = {
    profile: {
      name: "Sam Lee",
      email: "sam@example.com",
      phone: "+1 415 555 0199",
      country: "United States",
      location: "Seattle",
      links: [],
      summary: "Operations analyst with reporting experience.",
      skills: ["Excel", "Reporting"],
      experiences: [{
        title: "Operations Analyst",
        company: "Example Co",
        start: "2023",
        end: "Present",
        bullets: ["Weekly reporting for the operations team."],
      }],
      education: [], projects: [], certifications: [], languages: [], achievements: [],
    },
    roleTitleRaw: "Operations Analyst",
    jdText: "Operations Analyst responsible for Excel reporting and operations analysis.",
    template: "basic",
  } as unknown as GenerateRequest;

  const free = localTailor(req, null, "Example Co", false);
  assert.match(free.content.experiences[0].bullets[0], /^Delivered\b/);
  assert.ok(!/\d|%|\$/.test(free.content.experiences[0].bullets[0]), "must not invent a metric");
});
