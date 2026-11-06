import { embed } from "../llm";
import { containsLikePattern } from "../sql-search";
import { hasDb, q, withTransaction } from "./core";

export async function getCompanyBySlug(slug: string) {
  const rows = await q("select * from companies where slug=$1", [slug]);
  return rows[0] ?? null;
}

export async function searchCompanies(term: string, limit = 10, country?: string) {
  const termNormalized = term.trim();
  if (!termNormalized) return [];
  // q() degrades to [] with no pool, withTransaction throws. Keep the old
  // contract for callers running without a database.
  if (!hasDb()) return [];
  // Every fuzzy branch below pairs pg_trgm's % operator with the exact
  // similarity() test it used to run alone. % is the only form the trigram
  // indexes can serve, and because the threshold it compares against is set
  // below to the lowest this search uses, it is a pure prefilter: it can only
  // admit rows for the exact test to judge, never change the verdict. Without
  // it this scanned all 113k companies on every keystroke, 241ms measured.
  //
  // The one behavioural change is aliases. They are matched through
  // company_alias_text(), which joins them, so alias *similarity* is now
  // measured against the joined string rather than each alias separately; a
  // fuzzy hit on one alias of a company with many can fall below the threshold
  // where it previously matched. Exact and substring alias matches are
  // unaffected -- the joined string contains each alias verbatim.
  //
  // Wildcards are literal: "C++" or "50%" must match those names, not everything.
  const like = containsLikePattern(termNormalized);
  const bare = termNormalized.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  const nameThreshold = Math.max(0.18, Math.min(0.45, 0.72 - termNormalized.length * 0.025));
  const slugThreshold = Math.max(0.16, Math.min(0.4, 0.64 - bare.length * 0.025));

  // The prefilter has to compare against the *lowest* threshold this search
  // uses, or it would exclude rows the exact test would have kept. Setting it
  // per search rather than leaving the pool default matters a lot: at a blanket
  // 0.16 the normalised-slug branch handed the heap 12,440 candidate rows to
  // recheck for "goog" and took 159ms, where the real threshold for that term
  // (0.40) hands over 966 and takes 15ms.
  //
  // set_config(..., true) is transaction-local, so it reverts on commit and
  // cannot leak into whatever borrows this pooled connection next. That is also
  // why this runs in a transaction at all: a bare pool.query() could put the
  // set_config and the select on two different connections.
  const trigramFloor = Math.min(nameThreshold, slugThreshold);

  return withTransaction(async (query) => {
    await query("select set_config('pg_trgm.similarity_threshold', $1, true)", [String(trigramFloor)]);

    if (country) {
      const countryCode = country.toUpperCase();
      return query(
        `select slug, name, country_code, sector, tier
       from companies
       where name ilike $1 escape '\\'
          or slug ilike $1 escape '\\'
          or (name % $2 and similarity(name, $2) > $6)
          or (regexp_replace(slug, '^[a-z]{2}-', '') % $5
              and similarity(regexp_replace(slug, '^[a-z]{2}-', ''), $5) > $7)
          or (company_alias_text(aliases) ilike $1 escape '\\'
              and exists (select 1 from unnest(aliases) a where a ilike $1 escape '\\'))
          or (company_alias_text(aliases) % $2
              and exists (select 1 from unnest(aliases) a where similarity(a, $2) > $6))
       order by
         (country_code = $4) desc,
         (lower(name) = lower($2)) desc,
         (regexp_replace(slug, '^[a-z]{2}-', '') = $5) desc,
         tier asc,
         greatest(similarity(name, $2), similarity(regexp_replace(slug,'^[a-z]{2}-',''), $5)) desc
         limit $3`,
        [like, termNormalized, limit, countryCode, bare, nameThreshold, slugThreshold],
      );
    }

    return query(
      `select slug, name, country_code, sector, tier
       from companies
       where name ilike $1 escape '\\'
          or slug ilike $1 escape '\\'
          or (name % $2 and similarity(name, $2) > $5)
          or (regexp_replace(slug, '^[a-z]{2}-', '') % $4
              and similarity(regexp_replace(slug, '^[a-z]{2}-', ''), $4) > $6)
          or (company_alias_text(aliases) ilike $1 escape '\\'
              and exists (select 1 from unnest(aliases) a where a ilike $1 escape '\\'))
          or (company_alias_text(aliases) % $2
              and exists (select 1 from unnest(aliases) a where similarity(a, $2) > $5))
       order by
         (lower(name) = lower($2)) desc,
         (regexp_replace(slug, '^[a-z]{2}-', '') = $4) desc,
         tier asc,
         greatest(similarity(name, $2), similarity(regexp_replace(slug,'^[a-z]{2}-',''), $4)) desc
       limit $3`,
      [like, termNormalized, limit, bare, nameThreshold, slugThreshold],
    );
  });
}

export async function matchCompanyByText(queryText: string, limit = 3) {
  const text = queryText.trim();
  if (!hasDb() || !text) return [];
  const vector = await embed(text, { allowLocalFallback: false }).catch(() => null);
  if (!vector || vector.some((value) => !Number.isFinite(value))) return [];
  return q<{
    id: number;
    slug: string;
    name: string;
    score: number;
    sector: string | null;
    ats_system: string | null;
    ats_system_source_url: string | null;
    ats_system_verified_at: Date | null;
    size_band: string | null;
    style_profile: any;
  }>(
    `select c.id, c.slug, c.name, 1 - (c.embedding <=> $1::vector) as score, c.sector, c.ats_system, c.ats_system_source_url, c.ats_system_verified_at, c.size_band, c.style_profile
     from companies c
     where c.embedding is not null
     order by c.embedding <=> $1::vector
     limit $2`,
    [JSON.stringify(vector), limit],
  );
}
