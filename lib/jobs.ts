import { q } from "./db";
import { expandQueryWithTaxonomy } from "./job-search-expansion";

export type JobSearch = {
  query?: string;
  country?: string;
  jobType?: string;
  remote?: boolean;
  sort?: "posted" | "salary";
  page?: number;
  limit?: number;
};

// Markdown punctuation is stripped at the data boundary, not in the client:
// every consumer (cards, alerts, embeds) gets clean excerpts for free.
function cleanExcerpt(text: string): string {
  const cleaned = text.replace(/[#*_`~\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= 280) return cleaned;
  const cut = cleaned.slice(0, 280);
  // End at a sentence or word boundary so the excerpt never dies mid-word.
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentenceEnd >= 140) return cut.slice(0, sentenceEnd + 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 140)).trimEnd() + "…";
}

export async function searchJobs(input: JobSearch) {
  const where = [
    "expires_at > now()",
    "apply_url ~* '^https?://[^[:space:]]+$'",
  ];
  const values: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    where.push(sql.replace("?", `$${values.length}`));
  };

  // Escape ILIKE wildcards so user input can't smuggle expensive patterns
  // (e.g. "%%%") or match-anything filters into the query plan. The escape
  // char must be declared or Postgres treats the backslash as a literal.
  const query = input.query?.trim().slice(0, 100).replace(/([%_\\])/g, "\\$1");
  const rawQuery = input.query?.trim().slice(0, 100) ?? "";
  let relevanceExpr = "";
  if (query) {
    // Taxonomy expansion: "frontend engineer" also matches "frontend
    // developer" listings. Same-family terms only, original query always
    // first — expansion can widen a search, never narrow or hijack it.
    const terms = expandQueryWithTaxonomy(rawQuery).map(
      (term) => term.slice(0, 100).replace(/([%_\\])/g, "\\$1"),
    );
    const expanded = terms.length > 1;
    const clauses: string[] = [];
    let titleIlike = "";
    let companyIlike = "";
    for (const term of terms) {
      const value = `%${term}%`;
      values.push(value, value, value);
      if (!titleIlike) {
        titleIlike = `$${values.length - 2}`;
        companyIlike = `$${values.length - 1}`;
      }
      clauses.push(`(title ilike $${values.length - 2} escape '\\' or company ilike $${values.length - 1} escape '\\' or location ilike $${values.length} escape '\\')`);
    }
    where.push(clauses.length > 1 ? `(${clauses.join(" or ")})` : clauses[0]);

    // Relevance ranking for text searches: exact substring hits on the title
    // beat company-name hits beat location hits, trigram similarity breaks
    // ties between partial matches, and a 30-day freshness decay keeps stale
    // listings from camping on top. Explicit salary sort still wins — the
    // user asked for money order, not relevance order.
    if (input.sort !== "salary") {
      values.push(rawQuery); // unescaped — trigram similarity, not a LIKE pattern
      const titleSim = `$${values.length}`;
      // Expanded (synonym) matches rank below direct hits on the typed query:
      // widening recall should never push the exact ask below its synonyms.
      relevanceExpr = `(
        case when title ilike ${titleIlike} escape '\\' then 3${expanded ? " else 1.5" : " else 0"} end
        + similarity(title, ${titleSim}) * 2
        + case when company ilike ${companyIlike} escape '\\' then 1 else 0 end
        + greatest(0, 1 - extract(epoch from (now() - coalesce(date_posted, last_seen_at))) / 2592000)
      )`;
    }
  }
  // Case-insensitive, matching jobMarketIndexability(): a stored code of a
  // different case must never make a market searchable-but-invisible.
  if (input.country && /^[A-Z]{2}$/i.test(input.country)) add("lower(country_code) = lower(?)", input.country);
  if (input.jobType && ["fulltime", "parttime", "internship", "contract", "temporary"].includes(input.jobType)) {
    // JobSpy may return multiple comma-separated types (for example
    // "fulltime, internship"). Match a normalized token instead of only the
    // exact single-value form so filters do not silently drop mixed listings.
    add("? = any(string_to_array(replace(coalesce(job_type,''),' ',''), ','))", input.jobType);
  }
  if (input.remote) where.push("is_remote = true");

  const orderBy =
    input.sort === "salary"
      // Normalized annual-USD columns (migration 070 trigger): raw salary_max
      // mixes currencies and intervals, so 900k JPY would beat 90k USD.
      ? "salary_annual_usd_max desc nulls last, salary_annual_usd_min desc nulls last, date_posted desc nulls last, last_seen_at desc"
      : relevanceExpr
        ? `${relevanceExpr} desc, date_posted desc nulls last, last_seen_at desc`
        : "date_posted desc nulls last, last_seen_at desc";

  // NaN-safe bounds: Number("abc") is NaN and would otherwise reach Postgres.
  const limit = Math.max(1, Math.min(50, Number.isFinite(input.limit) ? Number(input.limit) : 20));
  const page = Math.max(1, Math.min(100, Number.isFinite(input.page) ? Number(input.page) : 1));
  values.push(limit, (page - 1) * limit);
  const limitParam = `$${values.length - 1}`;
  const offsetParam = `$${values.length}`;

  // Repost signal, folded into the page query so there is no second round
  // trip. Two distinct patterns, both capped to the page's rows so the cost
  // stays bounded:
  //
  // 1. Expired prior cycle: the same company posted (and delisted) a
  //    near-identical title within the last 90 days. Greenhouse data shows
  //    18-22% of postings in any quarter are ghost jobs, and companies that
  //    repeatedly repost the same title ghost measurably more often.
  // 2. Live twin: the same listing is live right now under another provider
  //    or external id (cross-board reposts — the most common duplicate).
  //    These get flagged AND dropped from the result set; one canonical card
  //    per real opening keeps the list honest.
  //
  // Title matching rides the pg_trgm indexes that already exist for search —
  // 0.65 tolerates the "(m/f/d)" and seniority suffixes delisted reposts pick
  // up, while live twins use 0.9 so genuinely different roles at one company
  // never collapse into each other. This is a signal for the seeker's
  // judgment, never an automatic rejection of a listing.
  const repostSql = `(
    exists (
      select 1 from jobs p
      where p.company = jobs.company
        and p.id <> jobs.id
        and p.expires_at <= now()
        and p.first_seen_at >= now() - interval '90 days'
        and similarity(p.title, jobs.title) >= 0.65
    )
    or exists (
      select 1 from jobs t
      where t.company = jobs.company
        and t.id <> jobs.id
        and t.expires_at > now()
        and similarity(t.title, jobs.title) >= 0.9
    )
  )`;
  const liveTwinSql = `exists (
    select 1 from jobs t
    where t.company = jobs.company
      and t.id <> jobs.id
      and t.expires_at > now()
      and similarity(t.title, jobs.title) >= 0.9
      and (
        t.date_posted > jobs.date_posted
        or (t.date_posted is not null and jobs.date_posted is null)
        or (t.date_posted is not distinct from jobs.date_posted and t.id < jobs.id)
      )
  )`;

  // Page 1 pays for the exact filtered count so the UI can promise "N jobs";
  // later pages only need to know whether one more page exists, so they fetch
  // limit+1 rows and skip the count(*) over() scan entirely.
  const pageSql = `select id, provider, external_id, title, company, country_code, location, is_remote, job_type,
           left(coalesce(description,''), 8000) description_text,
           apply_url, salary_min, salary_max, salary_currency, salary_interval,
           date_posted, last_seen_at,
           greatest(0, (current_date - date_posted::date))::int posted_days_ago,
           ${repostSql} reposted,
           ${liveTwinSql} is_live_twin
    from jobs
    where ${where.join(" and ")}
    order by ${orderBy}
    limit ${limitParam} offset ${offsetParam}`;

  if (page === 1) {
    let rows = await q<any>(
      `select *, count(*) over()::int total from (${pageSql}) page_rows where not is_live_twin`,
      values,
    );
    let fuzzy = false;
    // Typo-tolerant fallback: when exact substring matching finds nothing,
    // retry with pg_trgm similarity on the title (the field a typo actually
    // lands in) instead of returning an empty page. 0.3 is loose enough to
    // catch "javscript" → "javascript" but tight enough that unrelated roles
    // stay out; results are ranked by similarity, then freshness. The fuzzy
    // query re-declares its structured filters against its own parameter
    // array so $n indices stay honest (the ILIKE params are gone here).
    if (rows.length === 0 && query) {
      const fuzzyValues: unknown[] = [];
      const fuzzyWhere = [
        "expires_at > now()",
        "apply_url ~* '^https?://[^[:space:]]+$'",
      ];
      if (input.country && /^[A-Z]{2}$/i.test(input.country)) {
        fuzzyValues.push(input.country);
        fuzzyWhere.push(`lower(country_code) = lower($${fuzzyValues.length})`);
      }
      if (input.jobType && ["fulltime", "parttime", "internship", "contract", "temporary"].includes(input.jobType)) {
        fuzzyValues.push(input.jobType);
        fuzzyWhere.push(`$${fuzzyValues.length} = any(string_to_array(replace(coalesce(job_type,''),' ',''), ','))`);
      }
      if (input.remote) fuzzyWhere.push("is_remote = true");
      fuzzyValues.push(rawQuery); // unescaped — trigram similarity, not a LIKE pattern
      const titleParam = `$${fuzzyValues.length}`;
      fuzzyValues.push(limit);
      const fuzzyLimitParam = `$${fuzzyValues.length}`;
      rows = await q<any>(
        `select *, count(*) over()::int total from (
           select id, provider, external_id, title, company, country_code, location, is_remote, job_type,
                  left(coalesce(description,''), 8000) description_text,
                  apply_url, salary_min, salary_max, salary_currency, salary_interval,
                  date_posted, last_seen_at,
                  greatest(0, (current_date - date_posted::date))::int posted_days_ago,
                  ${repostSql} reposted,
                  ${liveTwinSql} is_live_twin,
                  similarity(title, ${titleParam}) title_similarity
           from jobs
           where ${fuzzyWhere.join(" and ")}
             and similarity(title, ${titleParam}) >= 0.3
           order by title_similarity desc, date_posted desc nulls last, last_seen_at desc
           limit ${fuzzyLimitParam}
         ) page_rows where not is_live_twin`,
        fuzzyValues,
      );
      fuzzy = rows.length > 0;
      for (const row of rows) delete row.title_similarity;
    }
    for (const row of rows) {
      row.description_excerpt = cleanExcerpt(row.description_text ?? "");
      // description_text (8k chars) stays on the row for fit-badge scoring
      // at the API boundary; the route strips it before responding.
      delete row.is_live_twin;
    }
    return { jobs: rows, total: Number(rows[0]?.total ?? 0), page, limit, fuzzy };
  }

  // Later pages only need to know whether one more page exists, so fetch
  // limit+1 rows and skip the count(*) over() scan entirely. null total =
  // "exact count unknown, don't promise one".
  values[values.length - 2] = limit + 1;
  const fetched = await q<any>(`select * from (${pageSql}) page_rows where not is_live_twin`, values);
  const rows = fetched.slice(0, limit);
  for (const row of rows) {
    row.description_excerpt = cleanExcerpt(row.description_text ?? "");
    delete row.is_live_twin;
  }
  return { jobs: rows, total: null as number | null, page, limit, fuzzy: false };
}

export async function getJob(id: string) {
  const rows = await q<any>(
    `select id, provider, title, company, country_code, location, city, state_region,
            is_remote, job_type, description, apply_url, source_url, company_url,
            salary_min, salary_max, salary_currency, salary_interval,
            date_posted, last_seen_at, metadata
     from jobs
     where id=$1
       and expires_at > now()
       and apply_url ~* '^https?://[^[:space:]]+$'`,
    [id],
  );
  return rows[0] ?? null;
}

export async function jobIndexHealth() {
  const totals = await q<any>(
    `select count(*)::int total, count(*) filter (where last_seen_at >= now() - interval '24 hours')::int fresh,
            max(last_seen_at) last_seen_at from jobs where expires_at > now()`,
  );
  const countries = await q<any>(
    `select country_code, count(*)::int total from jobs where expires_at > now()
     group by country_code order by total desc`,
  );
  const runs = await q<any>(
    `select status, country_code, search_term, providers, fetched_count, stored_count, error, started_at, finished_at
     from job_ingestion_runs order by started_at desc limit 12`,
  );
  return { ...(totals[0] ?? { total: 0, fresh: 0, last_seen_at: null }), countries, runs };
}
