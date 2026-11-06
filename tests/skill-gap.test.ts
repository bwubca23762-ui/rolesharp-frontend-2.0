import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyseSkillGap, byStatus, nextSteps, GAP_LIMITS } from "../lib/skill-gap";
import type { MapRole } from "../lib/career-map";

const source = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const analyst: MapRole = {
  slug: "data-analyst",
  title: "Data Analyst",
  sector: "Analytics",
  required_skills: ["SQL", "Excel", "Python", "Tableau"],
};
const engineer: MapRole = {
  slug: "software-engineer",
  title: "Software Engineer",
  sector: "IT",
  required_skills: ["Python", "Git", "Kubernetes"],
};

// Mentions Python. Says nothing about Git (which the analyst role also does not
// list) or Kubernetes (which neither lists).
const RESUME = `
Jane Doe — Data Analyst
Built reporting in Python that cut month-end close by three days.
Owned the weekly revenue dashboard for a team of twelve.
Reconciled ledger data across four regional entities.
`;

test("a skill the resume shows is evidenced, whatever the roles list", () => {
  const gap = analyseSkillGap(RESUME, engineer, analyst);
  assert.deepEqual(byStatus(gap, "evidenced").map((v) => v.skill), ["Python"]);
});

test("a skill the current role lists but the resume omits is undocumented, not missing", () => {
  // This split is the entire point of the module: telling someone to go and
  // learn what they already do daily is how you lose them.
  const gap = analyseSkillGap(RESUME, analyst, analyst);
  const undocumented = byStatus(gap, "undocumented").map((v) => v.skill);
  assert.deepEqual(undocumented.sort(), ["Excel", "SQL", "Tableau"]);
  assert.ok(undocumented.every((s) => !RESUME.toLowerCase().includes(s.toLowerCase())));
});

test("a skill neither the resume nor the current role has is unproven", () => {
  const gap = analyseSkillGap(RESUME, engineer, analyst);
  assert.deepEqual(byStatus(gap, "unproven").map((v) => v.skill).sort(), ["Git", "Kubernetes"]);
});

test("a gap is asked about and never asserted", () => {
  // lib/recruiter-feedback.ts set this rule: "you lack Kubernetes" is a claim
  // about the person that a document cannot support. A question is honest.
  const gap = analyseSkillGap(RESUME, engineer, analyst);
  for (const v of byStatus(gap, "unproven")) {
    assert.match(v.note, /\?$/, `"${v.note}" states a gap instead of asking about it`);
    assert.doesNotMatch(v.note, /\byou (lack|do not have|are missing|have not)\b/i);
  }
});

test("without a current role nothing is called undocumented", () => {
  // With no second role there is no basis for the claim, so the analysis must
  // not guess which side of the line a skill falls on.
  const gap = analyseSkillGap(RESUME, engineer, null);
  assert.equal(byStatus(gap, "undocumented").length, 0);
  assert.equal(gap.currentTitle, null);
});

test("coverage counts only what the resume evidences", () => {
  const gap = analyseSkillGap(RESUME, engineer, analyst);
  // Python of Python, Git, Kubernetes.
  assert.equal(gap.coverage, 33);
  assert.equal(analyseSkillGap(RESUME, { ...engineer, required_skills: ["Python"] }, null).coverage, 100);
});

test("a plural skill is satisfied by the singular on the page", () => {
  // The score counts "dashboards" and "dashboard" as different tokens, which is
  // right for keyword coverage. Asking whether someone has built dashboards
  // when their resume says "the weekly revenue dashboard" reads as not having
  // read it — the same call lib/recruiter-feedback.ts already made.
  const role: MapRole = { slug: "r", title: "R", sector: null, required_skills: ["Dashboards"] };
  const gap = analyseSkillGap("Owned the weekly revenue dashboard.", role, null);
  assert.equal(byStatus(gap, "evidenced").length, 1);
});

test("the fold does not credit a skill that merely shares a prefix", () => {
  // "Excel" is a prefix of "excellent". A stemmer loose enough to relate
  // "reconciled" to "Reconciliation" credits this one too, which is why the
  // fold stops at plurals and unfound skills are asked about, not asserted.
  const role: MapRole = { slug: "r", title: "R", sector: null, required_skills: ["Excel"] };
  const gap = analyseSkillGap("Excellent communication and stakeholder skills.", role, null);
  assert.equal(byStatus(gap, "evidenced").length, 0);
});

test("matching is whole-word, so Java does not satisfy JavaScript", () => {
  // termPresent() is shared with the checker precisely so this holds in both.
  const java: MapRole = { slug: "j", title: "J", sector: null, required_skills: ["Java"] };
  const gap = analyseSkillGap("Shipped a JavaScript rewrite of the checkout.", java, null);
  assert.equal(byStatus(gap, "evidenced").length, 0);
});

test("next steps lead with the undocumented ones and never invent work", () => {
  const withWork = nextSteps(analyseSkillGap(RESUME, analyst, analyst));
  assert.match(withWork[0], /current role lists/i);

  const done = nextSteps(analyseSkillGap(RESUME, { ...engineer, required_skills: ["Python"] }, null));
  assert.match(done[0], /already evidences every skill/i);
});

test("the route refuses an unknown target and never caches a resume", () => {
  const route = source("app/api/skill-gap/route.ts");
  assert.match(route, /unknown_target_role/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /rateLimit\(req, "skill-gap"/);
  // Aiming at the role you already hold must keep the current role, or every
  // gap is reported as having no basis in a history that plainly has one.
  assert.match(route, /const current = currentSlug \? await role\(currentSlug\) : null/);
});

test("the check says what it cannot support, and is crawlable", () => {
  assert.ok(GAP_LIMITS.length >= 3);
  // The "What this check is not" wall was retired 2026-10-18; the tool still
  // renders and the page stays crawlable + navigable.
  assert.match(source("app/skill-gap/page.tsx"), /SkillGapTool/);
  assert.match(source("app/sitemaps/[name]/route.ts"), /"\/skill-gap"/);
  assert.match(source("app/navigation-registry.ts"), /href: "\/skill-gap"/);
});
