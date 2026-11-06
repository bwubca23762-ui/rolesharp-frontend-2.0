import titleTaxonomy from "./job-match/title-taxonomy-v1.json";

// ── Taxonomy-aware search expansion ──
// Free-text job search has a vocabulary problem: a seeker types "frontend
// engineer" but half the market posts the same role as "frontend developer".
// The closed-world title taxonomy (lib/job-match/title-taxonomy-v1.json —
// the same one the match engine normalizes against) already encodes those
// equivalences, so search can expand a query into its synonym family instead
// of pretending the words are the whole truth.
//
// Deliberately conservative: expansion only adds SAME-FAMILY canonical titles
// and aliases, never related families (a UX researcher searching should not
// suddenly see product designers). The original query always stays in the
// OR-group, so expansion can only widen, never narrow or reorder a search
// that was already working.

export type TaxonomyTitle = {
  readonly id: string;
  readonly canonical: string;
  readonly family: string;
  readonly aliases: readonly string[];
};

const normalizeLexeme = (value: string): string =>
  value.normalize("NFKC").toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const TITLES = titleTaxonomy.titles as readonly TaxonomyTitle[];

/** Every searchable surface of one taxonomy entry, normalized. */
const SURFACES: readonly { title: TaxonomyTitle; surface: string }[] = TITLES.flatMap((title) => [
  { title, surface: normalizeLexeme(title.canonical) },
  ...title.aliases.map((alias) => ({ title, surface: normalizeLexeme(alias) })),
]);

/**
 * Expands a free-text query with same-family title synonyms. Returns the
 * deduplicated term list starting with the original query. Capped at 6 terms
 * so the generated OR-group stays cheap for the planner.
 */
export function expandQueryWithTaxonomy(query: string): string[] {
  const normalized = normalizeLexeme(query);
  if (normalized.length < 2) return [query];

  // A query "hits" the taxonomy when it contains a full canonical title or
  // alias as a phrase ("senior frontend engineer" hits "frontend engineer").
  const hitFamilies = new Set<string>();
  for (const { title, surface } of SURFACES) {
    if (surface.length >= 3 && ` ${normalized} `.includes(` ${surface} `)) {
      hitFamilies.add(title.family);
    }
  }
  if (hitFamilies.size === 0) return [query];

  const terms = new Set<string>([query]);
  for (const title of TITLES) {
    if (!hitFamilies.has(title.family)) continue;
    terms.add(title.canonical.toLocaleLowerCase("en"));
    for (const alias of title.aliases) terms.add(alias.toLocaleLowerCase("en"));
  }
  return [...terms].slice(0, 6);
}
