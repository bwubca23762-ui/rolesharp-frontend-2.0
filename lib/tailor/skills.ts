// Skill normalization, deduplication, and formatting helpers.
// Provenance: extracted from lib/tailor.ts during Phase 6 monolith refactor.

export const SKILL_EQUIVALENTS: Array<string[]> = [
  ["aws", "amazon web services"],
  ["ci/cd", "continuous integration", "continuous delivery", "cicd"],
  ["rest api", "rest apis", "restful api", "restful apis"],
  ["node.js", "nodejs"],
  ["react.js", "reactjs"],
  ["cross-functional collaboration", "stakeholder collaboration"],
];

export function uniqueTerms(values: string[], limit: number): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, limit);
}

export function canonicalSkillLabel(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/\(([^)]+)\)/g, " $1 ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
  for (const group of SKILL_EQUIVALENTS) {
    if (group.some((term) => {
      const key = term.toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();
      return normalized === key || normalized.includes(key) || key.includes(normalized);
    })) return group[0];
  }
  return normalized;
}

export function dedupeSkills(values: string[], limit = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    const key = canonicalSkillLabel(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

export function titleCaseTerm(s: string): string {
  return s.length <= 4 && !/[aeiou]/.test(s) ? s.toUpperCase() : s.replace(/\b\w/g, (c) => c.toUpperCase());
}
