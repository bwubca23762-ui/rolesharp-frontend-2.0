/**
 * The career map.
 *
 * Every competitor's version of this draws arrows between job titles — Analyst
 * becomes Senior Analyst becomes Manager, in about two years — and none of them
 * measured any of it. It is a picture of what careers are assumed to look like,
 * presented as data.
 *
 * This one draws only the edge it can defend: two roles are adjacent when the
 * occupational data lists the same skills for both. `roles.required_skills` and
 * `roles.preferred_skills` come from O*NET, ESCO and India's NCO (db/schema.sql),
 * so a shared skill is a sourced fact. The overlap is what transfers; the
 * difference is what does not. Nothing here claims anyone moves between these
 * roles, how long it takes, or what it pays, because nothing in this repo knows.
 *
 * Same contract as the generators: restructure what exists, name what is
 * missing, never fill the gap with something plausible.
 */

export type MapRole = {
  slug: string;
  title: string;
  sector: string | null;
  required_skills: string[];
  preferred_skills?: string[] | null;
};

export type Neighbour = {
  role: MapRole;
  /** Skills both roles list. What you already have if you hold the source role. */
  shared: string[];
  /** Listed for the neighbour and not for the source role. The actual gap. */
  missing: string[];
  /** Shared over the union, 0..1. Ranks the list; not a probability of anything. */
  overlap: number;
};

/** "Financial Reporting" and "financial reporting" are one skill. Matching is
 * case- and space-insensitive; the label shown to the user keeps the casing the
 * dataset used. */
function key(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, " ");
}

export function skillsOf(role: MapRole): string[] {
  const seen = new Map<string, string>();
  for (const skill of [...role.required_skills, ...(role.preferred_skills ?? [])]) {
    const k = key(skill);
    if (k && !seen.has(k)) seen.set(k, skill.trim());
  }
  return [...seen.values()];
}

/**
 * Roles that share at least one skill with `role`, strongest overlap first.
 *
 * A role with nothing in common is not a distant neighbour, it is not a
 * neighbour — an edge with no shared skill is exactly the unevidenced arrow
 * this module exists to avoid drawing.
 */
export function neighbours(role: MapRole, all: MapRole[], limit = 8): Neighbour[] {
  const own = new Map(skillsOf(role).map((s) => [key(s), s]));

  return all
    .filter((candidate) => candidate.slug !== role.slug)
    .map((candidate) => {
      const theirs = skillsOf(candidate);
      const shared: string[] = [];
      const missing: string[] = [];
      for (const skill of theirs) {
        (own.has(key(skill)) ? shared : missing).push(skill);
      }
      const union = own.size + missing.length;
      return { role: candidate, shared, missing, overlap: union === 0 ? 0 : shared.length / union };
    })
    .filter((n) => n.shared.length > 0)
    .sort((a, b) => b.overlap - a.overlap || b.shared.length - a.shared.length || a.role.title.localeCompare(b.role.title))
    .slice(0, limit);
}

/** The skills a source role gives you that no neighbour asks for. Worth naming:
 * they are the ones that do not travel, which is the honest half of "your
 * skills are transferable". */
export function skillsThatDoNotTravel(role: MapRole, found: Neighbour[]): string[] {
  const elsewhere = new Set(found.flatMap((n) => skillsOf(n.role).map(key)));
  return skillsOf(role).filter((skill) => !elsewhere.has(key(skill)));
}

export const MAP_LIMITS = [
  "An edge here means the occupational data lists the same skill for both roles. It does not mean people move between them, or that one leads to the other.",
  "There is no timeline, no salary and no difficulty rating, because nothing in this dataset measures any of those.",
  "Skills come from O*NET, ESCO and India's NCO. They describe the occupation as catalogued, not any particular job advert.",
  "A missing skill is a gap in the catalogue's terms, not a verdict on you. You may already have it under a different name.",
];
