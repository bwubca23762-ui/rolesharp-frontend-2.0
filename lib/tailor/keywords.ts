// Keyword analysis: gap detection, requirement mapping, and repair planning.
// Provenance: extracted from lib/tailor.ts during Phase 6 monolith refactor.

import type { GenerateRequest } from "../types";
import { type ResumeContent as RC } from "../types";
import { terms, METRIC_RE } from "../ats-score";
import { uniqueTerms } from "./skills";
import type { RoleNorm, RequirementMap } from "./types";

// The keyword bank a build is optimized against: the pasted JD when there is
// one, otherwise the canonical role's required skills. Target-role builds
// without a raw JD used to get zero optimization passes and plateau at 70-74.
export function targetKeywordBank(req: GenerateRequest, role: RoleNorm): string {
  if (req.jdText?.trim()) return req.jdText;
  return (role?.required_skills ?? []).join(", ");
}

export function missingKeywords(jd: string, content: RC, limit = 18): string[] {
  if (!jd.trim()) return [];
  // Must normalize the haystack the same way terms() canonicalizes JD terms —
  // otherwise "Node.js"/"CI/CD" in the resume never match the canonical terms
  // "nodejs"/"cicd" and the refine loop stuffs keywords that already exist.
  const hay = new Set(terms(JSON.stringify(content)));
  const jdTerms = [...new Set(terms(jd))];
  return jdTerms.filter((t) => !hay.has(t)).slice(0, limit);
}

export function profileTerms(req: GenerateRequest): Set<string> {
  return new Set(terms(JSON.stringify(req.profile)));
}

export function headlineSkills(req: GenerateRequest, role: RoleNorm): string[] {
  const jdTerms = new Set(terms(req.jdText ?? ""));
  const roleTitle = (role?.title ?? req.roleTitleRaw ?? "").toLowerCase();
  return (req.profile.skills ?? [])
    .filter((skill) => {
      const skillTerms = terms(skill);
      return skillTerms.some((term) => jdTerms.has(term)) && !roleTitle.includes(skill.toLowerCase());
    })
    .slice(0, 2);
}

export function requirementMap(req: GenerateRequest, role: RoleNorm): RequirementMap {
  const roleTerms = uniqueTerms(terms(role?.title ?? req.roleTitleRaw ?? ""), 5);
  const jdTerms = uniqueTerms(terms(targetKeywordBank(req, role)), 60);
  const explicitSkills = uniqueTerms((req.profile.skills ?? []).flatMap((skill) => terms(skill)), 40);
  const roleSkills = uniqueTerms((role?.required_skills ?? []).flatMap((skill) => terms(skill)), 30);
  const softSkillSeed = new Set(["collaboration", "communication", "leadership", "mentored", "mentoring", "stakeholder", "ownership", "analytics", "accessibility"]);
  const hardSkills = jdTerms.filter((term) => explicitSkills.includes(term) || roleSkills.includes(term)).slice(0, 14);
  const softSkills = jdTerms.filter((term) => softSkillSeed.has(term)).slice(0, 8);
  const domainTerms = jdTerms.filter((term) => !roleTerms.includes(term) && !hardSkills.includes(term) && !softSkills.includes(term)).slice(0, 10);
  return {
    title: roleTerms,
    hardSkills,
    softSkills,
    domainTerms,
  };
}

export function evidenceMap(req: GenerateRequest, role: RoleNorm) {
  const profile = req.profile;
  const skills = new Set((profile.skills ?? []).flatMap((skill) => terms(skill)));
  const experienceTerms = new Set((profile.experiences ?? []).flatMap((exp) => terms(`${exp.title} ${exp.company} ${(exp.bullets ?? []).join(" ")}`)));
  const projectTerms = new Set((profile.projects ?? []).flatMap((project) => terms(`${project.name} ${project.detail}`)));
  const educationTerms = new Set((profile.education ?? []).flatMap((edu) => terms(`${edu.degree} ${edu.school} ${edu.detail ?? ""}`)));
  const roleTerms = new Set((role?.required_skills ?? []).flatMap((skill) => terms(skill)));
  return { skills, experienceTerms, projectTerms, educationTerms, roleTerms };
}

export function supportedTerms(values: string[], evidence: ReturnType<typeof evidenceMap>, limit = 12): string[] {
  return values
    .filter((term) =>
      evidence.skills.has(term)
      || evidence.experienceTerms.has(term)
      || evidence.projectTerms.has(term)
      || evidence.educationTerms.has(term)
      || evidence.roleTerms.has(term))
    .slice(0, limit);
}

export function repairPlan(req: GenerateRequest, role: RoleNorm, content: RC) {
  const reqs = requirementMap(req, role);
  const evidence = evidenceMap(req, role);
  const missing = missingKeywords(targetKeywordBank(req, role), content, 24);
  const title = supportedTerms(reqs.title, evidence, 4);
  const hardSkills = supportedTerms(reqs.hardSkills.filter((term) => missing.includes(term)), evidence, 8);
  const softSkills = supportedTerms(reqs.softSkills.filter((term) => missing.includes(term)), evidence, 5);
  const domainTerms = supportedTerms(reqs.domainTerms.filter((term) => missing.includes(term)), evidence, 6);
  const weakBullets = content.experiences
    .flatMap((exp) => exp.bullets ?? [])
    .filter((bullet) => bullet && !METRIC_RE.test(bullet)) // same definition as the scorer
    .slice(0, 4);
  return { missing, title, hardSkills, softSkills, domainTerms, weakBullets };
}

export function supportedMissingKeywords(jd: string, req: GenerateRequest, content: RC, role: RoleNorm, limit = 12): string[] {
  const missing = missingKeywords(jd, content, 40);
  const supported = profileTerms(req);
  const explicitSkills = new Set((req.profile.skills ?? []).map((s) => s.toLowerCase()));
  // In role-only mode the bank IS the role's required skills — keeping the
  // roleTerms shortcut would accept every missing role skill unconditionally
  // (they are their own evidence) and stuff skills the candidate never had.
  // Role-only terms must be backed by the candidate's own profile, same as
  // JD terms always were.
  const roleOnly = !req.jdText?.trim();
  const roleTerms = roleOnly ? new Set<string>() : new Set((role?.required_skills ?? []).flatMap((s) => terms(s)));
  return missing
    .filter((term) => supported.has(term) || explicitSkills.has(term) || roleTerms.has(term))
    .slice(0, limit);
}
