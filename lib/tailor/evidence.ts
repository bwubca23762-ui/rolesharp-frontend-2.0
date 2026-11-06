// Evidence-safety guards: verify LLM output is grounded in real candidate facts.
// Provenance: extracted from lib/tailor.ts during Phase 6 monolith refactor.

import type { GenerateRequest } from "../types";

export function normalizedNumbers(value: string): string[] {
  return (value.match(/\d[\d,.]*/g) ?? []).map((item) => item.replace(/[,.]/g, "").replace(/^0+/, "") || "0");
}

export function namedTokens(value: string): string[] {
  return (value.match(/\b[A-Z][A-Za-z0-9.+#/-]{1,}\b/g) ?? []).slice(1).map((item) => item.toLowerCase());
}

export function evidenceSafeBullet(
  candidate: string,
  sourceExperience: GenerateRequest["profile"]["experiences"][number] | undefined,
  entireProfile?: GenerateRequest["profile"],
): boolean {
  if (!sourceExperience) return false;
  const source = JSON.stringify(sourceExperience);
  const sourceNumbers = new Set(normalizedNumbers(source));
  const sourceNamed = new Set(namedTokens(source));
  // Profile-wide scope: the AI legitimately weaves tools/skills from the
  // candidate's general Skills section (or other profile facts) into a role's
  // bullets. Scoping the check to only THIS experience rejected those bullets
  // and reverted them to the raw unquantified draft — the anti-improvement
  // behavior the score-elevation audit flagged. With the profile passed, any
  // tool or number that exists anywhere in the candidate's real profile is
  // allowed evidence; invented facts still fail the gate.
  const profileSource = entireProfile ? JSON.stringify(entireProfile) : source;
  const profileNumbers = new Set([...sourceNumbers, ...normalizedNumbers(profileSource)]);
  const allowedNamed = new Set([...sourceNamed, ...namedTokens(profileSource)]);
  return normalizedNumbers(candidate).every((item) => profileNumbers.has(item))
    && namedTokens(candidate).every((item) => allowedNamed.has(item));
}

export function evidenceSafeSummary(candidate: string, req: GenerateRequest, roleTitle: string, companyName?: string): boolean {
  const profileSource = JSON.stringify(req.profile);
  const namedSource = [profileSource, req.jdText ?? "", roleTitle, companyName ?? ""].join(" ");
  const profileNumbers = new Set(normalizedNumbers(profileSource));
  const allowedNamed = new Set(namedTokens(` ${namedSource}`));
  return normalizedNumbers(candidate).every((item) => profileNumbers.has(item))
    && namedTokens(` ${candidate}`).every((item) => allowedNamed.has(item));
}

export function experienceImpactLine(exp: GenerateRequest["profile"]["experiences"][number] | undefined): string {
  const facts = exp?.impactFacts;
  if (!facts) return "";
  return [facts.metric, facts.scope, facts.outcome, facts.timeframe].filter(Boolean).join(" | ");
}

export function compactBullet(value: string, max = 198): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const candidate = clean.slice(0, max - 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > 120 ? boundary : max - 1).replace(/[,:;\s-]+$/, "")}...`;
}

export function bulletWithImpact(base: string, impact: string): string {
  const conciseImpact = compactBullet(impact.replace(/\s*\|\s*/g, ", "), 92).replace(/...$/, "");
  const roomForBase = Math.max(90, 198 - conciseImpact.length - 3);
  return compactBullet(`${compactBullet(base, roomForBase)} (${conciseImpact})`);
}

export function startsWithActionVerb(bullet: string): boolean {
  return /^(achieved|analyzed|architected|automated|built|championed|created|delivered|designed|developed|drove|engineered|implemented|improved|increased|launched|led|managed|mentored|optimized|owned|partnered|reduced|shipped|streamlined)\b/i.test(bullet.trim())
    || /^[a-z]+ed\b/i.test(bullet.trim());
}
