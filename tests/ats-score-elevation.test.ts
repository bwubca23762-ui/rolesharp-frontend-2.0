import test from "node:test";
import assert from "node:assert/strict";
import { checkResumeContent } from "../lib/resume-checker";
import { atsScore, atsDiagnostics } from "../lib/ats-score";
import { evidenceSafeBullet } from "../lib/tailor/evidence";
import type { GenerateRequest, ResumeContent } from "../lib/types";

// ---------------------------------------------------------------------------
// ATS score elevation & anti-degradation engine (master prompt, 7 pillars).
//
// Production telemetry: mean 73.5, only 3.9% of live resumes at 90+, and the
// /build meter collapsing 15-25 points the moment a JD was pasted. These tests
// pin the six elevation behaviors:
//   1. Context (targetRole + roleSkills) lifts a standard profile past 88.
//   2. Student projects split into sentences — no long-bullet penalties.
//   3. No-JD hard skills grade on the resume's own evidence, never 0%.
//   4. "City, ST" location formats get contact credit.
//   5. Pasting a JD never drops an existing draft by more than 10 points.
//   6. evidenceSafeBullet accepts skills from the profile-wide source.
// ---------------------------------------------------------------------------

const ROLE = "Software Engineer";

const JD = `We are hiring a Software Engineer to build backend services.
Requirements: Python, SQL, AWS, Docker, REST API design, CI/CD, Git,
PostgreSQL, unit testing, agile, cross-functional collaboration, communication.`;

// A standard, well-crafted 4-year developer profile: quantified bullets,
// 15 real tools, complete contact info — the kind of resume that used to
// land in the 70-78 band.
const developerResume: ResumeContent = {
  headline: "Software Engineer",
  contact: {
    email: "alex@example.com",
    phone: "+1 415 555 0100",
    location: "Austin, TX",
    linkedin: "https://linkedin.com/in/alexrivera",
  },
  summary:
    "Software Engineer with 4 years of experience building Python and SQL services on AWS. Shipped Dockerized REST APIs with CI/CD pipelines, PostgreSQL data models, and strong unit testing discipline for cross-functional agile teams.",
  skills: [
    "Python", "SQL", "PostgreSQL", "AWS", "Docker", "REST API", "CI/CD",
    "Git", "Unit Testing", "Agile", "Cross-functional Collaboration",
    "Communication", "Linux", "Terraform", "Kafka",
  ],
  experiences: [
    {
      title: "Software Engineer",
      company: "Acme Corp",
      period: "Jan 2022 - Present",
      bullets: [
        "Built Python REST services on AWS serving 1.2M monthly requests with 99.9% uptime.",
        "Cut CI/CD release time from 3 hours to 25 minutes with Docker and Git workflows.",
        "Designed PostgreSQL schemas that reduced report query time by 40% for 200 analysts.",
        "Mentored 2 interns on unit testing and SQL performance, both hired full-time.",
      ],
    },
    {
      title: "Junior Developer",
      company: "Beta Systems",
      period: "Jun 2020 - Dec 2021",
      bullets: [
        "Automated 30+ weekly reports with Python and SQL, saving the ops team 12 hours per week.",
        "Migrated 14 services to Docker containers, reducing deployment failures by 60%.",
        "Wrote integration tests covering 85% of the billing module across 3 services.",
      ],
    },
  ],
  education: [
    { degree: "B.S. Computer Science", school: "State University", year: "2020", detail: "Coursework in databases, distributed systems." },
  ],
  projects: [],
  certifications: ["AWS Certified Cloud Practitioner"],
  languages: ["English"],
  achievements: [],
};

const studentResume: ResumeContent = {
  headline: "Data Analyst",
  contact: {
    email: "priya@example.com",
    phone: "+91 98765 43210",
    location: "Mumbai, MH",
  },
  summary:
    "Final-year Computer Science student with hands-on project experience in Python, SQL, Excel, and Tableau. Completed two data analytics internships and delivered an academic dashboard project used by 400 students.",
  skills: ["Python", "SQL", "Excel", "Tableau", "Pandas", "Data Visualization", "Statistics"],
  experiences: [],
  education: [
    { degree: "B.Tech Computer Science", school: "Mumbai University", year: "2026", detail: "CGPA 8.7/10. Coursework in statistics and machine learning." },
  ],
  projects: [
    {
      name: "Retail Sales Analytics",
      detail: "Built a Python and SQL pipeline analyzing 120,000 retail transactions for a capstone project. Reduced manual reporting effort by 8 hours per week for a 5-person team. Visualized regional trends in Tableau dashboards adopted by the department faculty.",
    },
    {
      name: "Campus Placement Tracker",
      detail: "Developed a placement tracking web app used by 400 students. Automated resume shortlisting with Python, cutting screening time by 35%.",
    },
  ],
  certifications: ["Google Data Analytics Certificate"],
  languages: ["English", "Hindi"],
  achievements: ["Winner, university analytics case competition 2025 (120 teams)"],
};

test("pillar 1 — context (targetRole + roleSkills) lifts a standard profile to 88+", () => {
  const bare = atsScore("", developerResume);
  const contextual = atsScore("", developerResume, {
    targetRole: ROLE,
    roleSkills: developerResume.skills,
  });
  // Context may raise the score (role-word searchability, explicit role
  // skills) but must never lower it — the old meter stripped 16-26 points.
  assert.ok(contextual >= bare, `context must not lower the score (${bare} -> ${contextual})`);
  assert.ok(contextual >= 88, `expected context-elevated score >= 88, got ${contextual}`);
});

test("pillar 2 — no-JD hard skills grade on resume evidence, never 0%", () => {
  const result = checkResumeContent(developerResume, {
    jdText: undefined,
    targetRole: ROLE,
    roleSkills: developerResume.skills,
  });
  const hard = result.keywordGroups.find((g) => g.label === "Hard skills");
  assert.ok(hard, "hard skill group present");
  assert.ok(
    (hard?.coverage ?? 0) >= 75,
    `expected hard-skill coverage >= 75% without a JD, got ${hard?.coverage}%`,
  );
  // The meter path with NO role skills at all (user never typed a skills
  // field): the resume text itself must still evidence the hard skills.
  const textOnly = checkResumeContent(developerResume, { jdText: undefined });
  const textHard = textOnly.keywordGroups.find((g) => g.label === "Hard skills");
  assert.ok(
    (textOnly.breakdown.find((b) => b.label === "Keyword match")?.score ?? 0) > 0,
    "keyword score must not be zeroed",
  );
  assert.ok(
    (textHard?.coverage ?? 0) >= 75,
    `expected text-mined hard-skill coverage >= 75%, got ${textHard?.coverage}%`,
  );
});

test("pillar 3 — pasting a JD never collapses an existing draft by more than 10 points", () => {
  const before = atsScore("", developerResume, {
    targetRole: ROLE,
    roleSkills: developerResume.skills,
  });
  const after = atsScore(JD, developerResume, {
    targetRole: ROLE,
    roleSkills: developerResume.skills,
  });
  assert.ok(
    after >= before - 10,
    `JD paste must not collapse the score by more than 10 points (${before} -> ${after})`,
  );
});

test("pillar 4 — City, ST / City,Province location formats earn contact credit", () => {
  for (const location of ["Austin, TX", "San Francisco, CA", "New York, NY", "Toronto, ON", "Seattle, WA"]) {
    const result = checkResumeContent({
      ...developerResume,
      contact: { ...developerResume.contact, location },
    }, {});
    assert.equal(result.detected.location, true, `${location} must register as a location`);
    assert.ok(
      result.breakdown.find((b) => b.label === "Contact")?.score === 10,
      `${location} should earn full contact (email+phone+location+linkedin)`,
    );
  }
  // Two-letter words after a comma must NOT count ("Hello, my name is...").
  const falsePositive = checkResumeContent({
    ...developerResume,
    contact: { email: "alex@example.com", phone: "+1 415 555 0100", location: "Hello, my" },
  }, {});
  assert.equal(falsePositive.detected.location, false, "lowercase two-letter tokens are not locations");
});

test("pillar 5 — student projects split into sentences, no long-bullet penalty", () => {
  const result = checkResumeContent(studentResume, {
    jdText: "Data analyst internship: Python, SQL, Excel, Tableau, dashboards, reporting, statistics.",
    targetRole: "Data Analyst",
    roleSkills: studentResume.skills,
  });
  assert.equal(result.detected.longBullets, 0, "no project paragraph may register as a long bullet");
  assert.ok(
    result.breakdown.find((b) => b.label === "Readability")?.score === 10,
    "clean split projects should keep full readability credit",
  );
  assert.ok(result.score >= 82, `expected student profile >= 82, got ${result.score}`);
});

test("pillar 6 — evidenceSafeBullet accepts tools named anywhere in the profile", () => {
  const profile = {
    name: "Alex",
    email: "alex@example.com",
    location: "Austin",
    summary: "Backend engineer.",
    skills: ["Python", "SQL", "Kafka", "Docker"],
    experiences: [{
      title: "Engineer",
      company: "Acme",
      start: "2022",
      end: "Present",
      bullets: ["Built REST services for 1M users."],
    }],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
    achievements: [],
  } as unknown as GenerateRequest["profile"];
  const sourceExp = profile.experiences[0];
  // Kafka is not in THIS experience — but it is in the candidate's skills.
  // The profile-wide scope must accept the bullet instead of reverting it.
  assert.equal(
    evidenceSafeBullet("Streamlined Kafka ingestion pipelines for 1M users", sourceExp, profile),
    true,
    "profile-sourced tools must be allowed evidence",
  );
  // A number that exists nowhere in the profile is still rejected.
  assert.equal(
    evidenceSafeBullet("Streamlined Kafka ingestion pipelines for 7M users", sourceExp, profile),
    false,
    "invented metrics still fail the gate",
  );
  // Without the profile argument, legacy behavior is unchanged.
  assert.equal(
    evidenceSafeBullet("Streamlined Kafka ingestion pipelines for 1M users", sourceExp),
    false,
    "experience-only scope still rejects cross-profile facts",
  );
});

test("pillar 7 — meter diagnostics expose the context-elevated score", () => {
  const diagnostics = atsDiagnostics("", developerResume, {
    targetRole: ROLE,
    roleSkills: developerResume.skills,
  });
  assert.ok(diagnostics.score >= 88, `meter must show the elevated score, got ${diagnostics.score}`);
  assert.equal(diagnostics.score, atsScore("", developerResume, {
    targetRole: ROLE,
    roleSkills: developerResume.skills,
  }));
});
