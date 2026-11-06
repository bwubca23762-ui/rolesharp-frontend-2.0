// Polish logic: evidence-guarded content refinement after LLM generation.
// Provenance: extracted from lib/tailor.ts during Phase 6 monolith refactor.

import type { GenerateRequest } from "../types";
import { type ResumeContent as RC } from "../types";
import { terms, METRIC_RE } from "../ats-score";
import { canonicalSkillLabel, dedupeSkills } from "./skills";
import {
  evidenceSafeBullet,
  evidenceSafeSummary,
  experienceImpactLine,
  compactBullet,
  bulletWithImpact,
  startsWithActionVerb,
} from "./evidence";
import { headlineSkills } from "./keywords";
import type { RoleNorm } from "./types";

function injectContact(content: RC, req: GenerateRequest): RC {
  const location = req.profile.location || "";
  const country = req.profile.country || "";
  const locationWithCountry = country && !location.toLowerCase().includes(country.toLowerCase())
    ? [location, country].filter(Boolean).join(", ")
    : location || country || undefined;
  content.contact = {
    email: req.profile.email || undefined,
    phone: req.profile.phone || undefined,
    linkedin: req.profile.linkedin || undefined,
    location: locationWithCountry,
    links: req.profile.links?.length ? req.profile.links : undefined,
  };
  return content;
}

export function evidenceSummary(req: GenerateRequest, roleTitle: string, companyName?: string): string {
  const base = req.profile.summary?.trim()
    || `${req.profile.careerLevel || "Professional"} candidate with documented experience, education, projects, and skills.`;
  const strengths = req.profile.skills.slice(0, 8);
  return [
    base,
    roleTitle ? `Target role: ${roleTitle}.` : "",
    strengths.length ? `Core strengths: ${strengths.join(", ")}.` : "",
    companyName ? `Tailored for ${companyName}.` : "",
  ].filter(Boolean).join(" ");
}

export function polishContent(content: RC, req: GenerateRequest, role: RoleNorm, companyName?: string, premium = false): RC {
  const explicitSkills = (req.profile.skills ?? []).filter(Boolean);
  const evidenceTerms = new Set(terms(JSON.stringify(req.profile)));
  const explicitSkillKeys = new Set(explicitSkills.map(canonicalSkillLabel));
  const supportedSkills = (content.skills ?? []).filter((skill) => {
    if (explicitSkillKeys.has(canonicalSkillLabel(skill))) return true;
    const skillTerms = terms(skill);
    return skillTerms.length > 0 && skillTerms.every((term) =>
      [...evidenceTerms].some((evidence) => evidence === term || evidence.slice(0, 6) === term.slice(0, 6)),
    );
  });
  const mergedSkills = dedupeSkills([...supportedSkills, ...explicitSkills], 20);
  const roleTitle = role?.title ?? req.roleTitleRaw ?? "";
  const emphasis = headlineSkills(req, role);
  const headlineBits = [roleTitle, emphasis.join(", "), companyName].filter(Boolean);
  if (headlineBits.length) content.headline = headlineBits.join(" — ");
  // Keep the LLM's tailored summary for either tier when it is provably
  // grounded in the candidate's own facts. Discarding it for free resumes
  // threw away the most natural place to surface supported JD language.
  const llmSummary = content.summary?.trim();
  content.summary = llmSummary && llmSummary.length >= 80 && evidenceSafeSummary(llmSummary, req, roleTitle, companyName)
    ? llmSummary
    : evidenceSummary(req, roleTitle, companyName);
  content.skills = mergedSkills;
  if (content.summary) {
    content.summary = content.summary
      .replace(/\bAmazon Web Services(?:\s*\(AWS\))?\b/gi, "AWS")
      .replace(/\bAWS and Amazon Web Services\b/gi, "AWS")
      .replace(/\bCI\/CD(?:\s*&\s*continuous integration)?\b/gi, "CI/CD")
      .replace(/\bcontinuous integration and delivery\b/gi, "CI/CD")
      .replace(/\bcontinuous integration\b/gi, "CI/CD")
      .replace(/\s+/g, " ")
      .trim();
  }
  content.projects = (content.projects ?? []).map((project) => ({
    ...project,
    detail: project.detail
      .replace(/\bAmazon Web Services(?:\s*\(AWS\))?\b/gi, "AWS")
      .replace(/\bcontinuous integration and delivery\b/gi, "CI/CD")
      .replace(/\bcontinuous integration\b/gi, "CI/CD")
      .replace(/\s+/g, " ")
      .trim(),
  }));
  // Experience identity and dates are hard facts. Build from the source list
  // so an LLM cannot rename/drop a role or silently remove its date range.
  // Generated wording is considered only for the corresponding source bullet.
  content.experiences = req.profile.experiences.map((sourceExp, index) => {
    const generatedExp = content.experiences[index];
    return {
      title: sourceExp.title,
      company: sourceExp.company,
      period: [sourceExp.start, sourceExp.end].filter(Boolean).join(" - "),
      bullets: (sourceExp.bullets ?? []).map((sourceBullet, bulletIndex) => {
        const bullet = generatedExp?.bullets?.[bulletIndex] ?? sourceBullet;
        const clean = bullet.trim();
        if (!clean) return clean;
        const original = sourceBullet.trim() || clean;
        // Profile-wide evidence scope: named tools and numbers may come from
        // anywhere in the candidate's real profile (skills, other roles,
        // projects) — not just this experience's source JSON. Rejecting
        // cross-profile facts reverted AI-improved bullets to raw drafts.
        const safe = !evidenceSafeBullet(clean, sourceExp, req.profile)
          ? original
          : startsWithActionVerb(clean) ? clean : `Delivered ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
        // Premium: bullets without a metric borrow the user's own structured
        // impact facts (same behavior the local fallback already has) — this is
        // the single biggest Impact-score lever and it is 100% user-provided.
        if (premium && !METRIC_RE.test(safe)) {
          const impact = experienceImpactLine(sourceExp);
          if (impact) return bulletWithImpact(safe, impact);
        }
        return compactBullet(safe);
      }),
    }});
  return injectContact(content, req);
}
