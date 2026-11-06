import { embed } from "../llm";
import { containsLikePattern } from "../sql-search";
import { hasDb, q } from "./core";

export async function getRoleBySlug(slug: string) {
  const rows = await q("select * from roles where slug=$1", [slug]);
  return rows[0] ?? null;
}

export async function listRoles(limit = 60) {
  return q(
    `select slug, title, sector from roles
     order by (source='manual') desc, title limit $1`,
    [limit],
  );
}

/** Roles carrying their skill arrays, for the career map. Roles with no skills
 * listed are excluded rather than rendered as a node with no edges. */
export async function listRolesWithSkills(limit = 60) {
  return q<{ slug: string; title: string; sector: string | null; required_skills: string[]; preferred_skills: string[] }>(
    `select slug, title, sector, required_skills, preferred_skills from roles
     where cardinality(required_skills) > 0
     order by (source='manual') desc, title limit $1`,
    [limit],
  );
}

export async function searchRoles(term: string, limit = 20) {
  const normalized = term.trim();
  if (!normalized) return [];
  const threshold = Math.max(0.18, Math.min(0.4, 0.66 - normalized.length * 0.025));
  return q(
    `select slug, title, sector from roles
     where title ilike $1 escape '\\' or similarity(title, $2) > $4
     order by
       (lower(title) = lower($2)) desc,
       (source='manual') desc,
       similarity(title, $2) desc,
       length(title),
       title
     limit $3`,
    // Wildcards are literal: a search for "C_A" must not match "CTA".
    [containsLikePattern(normalized), normalized, limit, threshold],
  );
}

export async function matchRoleByText(queryText: string, limit = 3) {
  const text = queryText.trim();
  if (!hasDb() || !text) return [];
  const vector = await embed(text, { allowLocalFallback: false }).catch(() => null);
  if (!vector || vector.some((value) => !Number.isFinite(value))) return [];
  const safe = vector.map((value) => (Number.isFinite(value) ? value : 0));
  return q<{
    id: number;
    slug: string;
    title: string;
    score: number;
    required_skills: string[];
    typical_bullets: string[];
  }>(
    `select r.id, r.slug, r.title, 1 - (r.embedding <=> $1::vector) as score, r.required_skills, r.typical_bullets
     from roles r
     where r.embedding is not null
     order by r.embedding <=> $1::vector
     limit $2`,
    [JSON.stringify(safe), limit],
  );
}
