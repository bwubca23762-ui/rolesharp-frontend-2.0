// Shared types for the tailor module family.
// Provenance: extracted from lib/tailor.ts during Phase 6 monolith refactor.

export type RoleNorm = { title: string; required_skills: string[]; typical_bullets: string[] } | null;

export type RequirementMap = {
  title: string[];
  hardSkills: string[];
  softSkills: string[];
  domainTerms: string[];
};
