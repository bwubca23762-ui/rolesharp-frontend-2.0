import { hasMetric, terms as atsTerms } from "./ats-score";
import { checkResumeContent } from "./resume-checker";
import type { GenerateRequest, ResumeContent } from "./types";
import type { CompanyContext } from "./company-context";

const STOP = new Set([
  "the", "and", "for", "with", "you", "your", "are", "will", "this", "that", "have", "from", "into", "our", "their", "about", "role",
  "looking", "seeking", "join", "team", "services", "service", "applications", "application", "systems", "system", "web", "app",
]);

function terms(text: string) {
  return [...new Set((text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []).filter((t) => !STOP.has(t)))];
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function summarize(
  req: GenerateRequest,
  roleTitle: string,
  companyName?: string,
  extraTerms: string[] = [],
  companyContext?: CompanyContext,
) {
  const skills = [...new Set([...(req.profile.skills ?? []), ...extraTerms.map(titleCase)])].slice(0, 8);
  const emphasis = companyContext?.styleProfile?.summary_focus?.slice(0, 3) ?? [];
  const parts = [
    req.profile.summary?.trim() || `${roleTitle} with hands-on experience building production-ready work.`,
    companyName ? `Tailored for ${companyName}.` : "",
    companyContext?.sector ? `Aligned to ${companyContext.sector} hiring language.` : "",
    emphasis.length ? `Emphasis: ${emphasis.join(", ")}.` : "",
    skills.length ? `Core strengths: ${skills.join(", ")}.` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function improveBullet(bullet: string) {
  const clean = bullet.trim().replace(/\.$/, "");
  // Prepending "Delivered" to something that already starts with a verb makes
  // word salad ("Delivered coordinated…"). Treat the whitelist AND any leading
  // past-tense-looking word (-ed) as an action verb; only prepend when the
  // bullet clearly starts with a noun phrase ("Weekly reports for…").
  const startsWithVerb =
    /^(achieved|analyzed|architected|automated|built|championed|created|delivered|designed|developed|drove|engineered|implemented|improved|increased|launched|led|managed|mentored|optimized|owned|partnered|reduced|reviewed|shipped|streamlined|worked|wrote)\b/i.test(clean) ||
    /^[a-z]+ed\b/i.test(clean);
  return startsWithVerb ? clean : `Delivered ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
}

function supportedExtraTerms(req: GenerateRequest, roleTitle: string, premium: boolean) {
  const jdTerms = atsTerms(req.jdText ?? "");
  const roleTerms = new Set(terms(roleTitle));
  const supported = new Set([
    ...terms(JSON.stringify(req.profile)),
    ...((req.profile.skills ?? []).flatMap((s) => terms(s))),
  ]);
  const filtered = [...new Set(jdTerms)]
    .filter((term) => term.length > 3)
    .filter((term) => !roleTerms.has(term))
    .filter((term) => supported.has(term))
    .slice(0, premium ? 20 : 10);
  return filtered;
}

function impactFactsLine(facts?: { metric?: string; scope?: string; outcome?: string; timeframe?: string }) {
  if (!facts) return "";
  return [facts.metric, facts.scope, facts.outcome, facts.timeframe].filter(Boolean).join(" | ");
}

function compactBullet(value: string, max = 198) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const candidate = clean.slice(0, max - 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > 120 ? boundary : max - 1).replace(/[,:;\s-]+$/, "")}…`;
}

function bulletWithImpact(base: string, impact: string) {
  const conciseImpact = compactBullet(impact.replace(/\s*\|\s*/g, ", "), 92).replace(/…$/, "");
  const roomForBase = Math.max(90, 198 - conciseImpact.length - 3);
  return compactBullet(`${compactBullet(base, roomForBase)} (${conciseImpact})`);
}

export function localTailor(
  req: GenerateRequest,
  role: { title: string; required_skills: string[]; typical_bullets: string[] } | null,
  companyName?: string,
  premium = false,
  companyContext?: CompanyContext,
): { content: ResumeContent; atsScore: number } {
  const roleTitle = role?.title ?? req.roleTitleRaw ?? "Professional";
  const location = req.profile.location || "";
  const country = req.profile.country || "";
  const locationWithCountry = country && !location.toLowerCase().includes(country.toLowerCase())
    ? [location, country].filter(Boolean).join(", ")
    : location || country || undefined;
  const extraTerms = supportedExtraTerms(req, roleTitle, premium);
  const baseSkills = req.profile.skills ?? [];
  const supported = new Set(terms(JSON.stringify(req.profile)));
  const roleSkills = (role?.required_skills ?? []).filter((skill) => terms(skill).some((term) => supported.has(term)));
  const skills = [...new Set([...baseSkills, ...roleSkills, ...extraTerms.map(titleCase)])].slice(0, premium ? 20 : 16);
  const experiences = (req.profile.experiences ?? []).map((e) => ({
    title: e.title,
    company: e.company,
    period: [e.start, e.end].filter(Boolean).join(" - "),
    bullets: (e.bullets ?? []).map((b) => {
      const improved = improveBullet(b);
      const impact = impactFactsLine(e.impactFacts);
      // hasMetric (ats-score) — bare `x\b` matched "linux"/"UX" and silently
      // skipped impact facts on those bullets.
      if (!premium || !impact || hasMetric(improved)) return compactBullet(improved);
      return bulletWithImpact(improved, impact);
    }).slice(0, 5),
  }));
  const content: ResumeContent = {
    headline: companyName ? `${roleTitle} Resume for ${companyName}` : `${roleTitle} Resume`,
    contact: {
      email: req.profile.email || undefined,
      phone: req.profile.phone || undefined,
      linkedin: req.profile.linkedin || undefined,
      location: locationWithCountry,
      links: req.profile.links?.length ? req.profile.links : undefined,
    },
    summary: summarize(req, roleTitle, companyName, extraTerms, companyContext),
    skills,
    experiences,
    education: (req.profile.education ?? []).map((e) => ({ degree: e.degree, school: e.school, year: e.year, detail: e.detail })),
    projects: (req.profile.projects ?? []).map((p) => ({ name: p.name, detail: p.detail })),
    certifications: req.profile.certifications ?? [],
    languages: req.profile.languages ?? [],
    achievements: req.profile.achievements ?? [],
  };
  // roleSkills: the local fallback is also the no-JD baseline for target-role
  // builds — grade it against the role's skill bank like the AI path does.
  return { content, atsScore: checkResumeContent(content, { jdText: req.jdText, targetRole: roleTitle, targetCompany: companyName, roleSkills: role?.required_skills?.length ? role.required_skills : undefined }).score };
}
