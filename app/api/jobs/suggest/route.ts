import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { env } from "@/lib/env";
import { getJobPreferences } from "@/lib/job-preferences";
import { containsLikePattern } from "@/lib/sql-search";

export const runtime = "nodejs";

// GET /api/jobs/suggest?role=&country= — live openings matched to the resume
// the user just built, filtered by their job-location preferences (migration
// 066) when they are signed in. No fabricated match scores: these are live
// postings whose title matches the role, ordered home-market first.
// Weekly alerts are NOT auto-created here — the UI offers an explicit opt-in
// button (email starts opted out everywhere else in this platform).
export async function GET(req: NextRequest) {
  const user = await currentUser();
  const role = req.nextUrl.searchParams.get("role")?.trim() || "";
  const fallbackCountry = (req.nextUrl.searchParams.get("country")?.trim().toUpperCase() || "US").slice(0, 2);

  if (role.length < 2) return NextResponse.json({ jobs: [] });

  const prefs = user && !env.localDevMode ? await getJobPreferences(user.id).catch(() => null) : null;
  const scope = prefs?.locationScope ?? "both";
  const homeCountry = prefs?.homeCountry || fallbackCountry;
  const targetCountries = prefs?.targetCountries?.length ? prefs.targetCountries : ["US", "GB", "CA", "DE", "AE"];

  const words = role.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  if (!words.length) return NextResponse.json({ jobs: [], scope, homeCountry });

  const values: unknown[] = [homeCountry, targetCountries];
  let countryCondition: string;
  if (scope === "in_country") {
    countryCondition = "country_code = $1";
  } else if (scope === "out_of_country") {
    countryCondition = "(country_code != $1 and (country_code = any($2::text[]) or is_remote = true))";
  } else {
    countryCondition = "(country_code = $1 or country_code = any($2::text[]) or is_remote = true)";
  }

  const titleConditions = words.map((word) => {
    values.push(containsLikePattern(word));
    return `title ilike $${values.length}`;
  });

  values.push(5);
  const limitParam = `$${values.length}`;

  const select = `select id, title, company, location, country_code, salary_min, salary_max, salary_currency,
         is_remote, apply_url, date_posted::text as date_posted from jobs`;

  const sql = `
    ${select}
    where expires_at > now()
      and apply_url ~* '^https?://[^[:space:]]+$'
      and ${countryCondition}
      and ${titleConditions.join(" and ")}
    order by
      case when country_code = $1 then 1 else 2 end,
      date_posted desc nulls last,
      last_seen_at desc
    limit ${limitParam}`;

  let jobs = await q<Record<string, unknown>>(sql, values).catch(() => []);

  // Single-word fallback when the multi-term AND came back empty.
  if (jobs.length < 2) {
    const fallbackValues = [homeCountry, targetCountries, containsLikePattern(words[0]), 5];
    jobs = await q<Record<string, unknown>>(
      `${select}
       where expires_at > now()
         and apply_url ~* '^https?://[^[:space:]]+$'
         and (country_code = $1 or country_code = any($2::text[]) or is_remote = true)
         and title ilike $3
       order by date_posted desc nulls last
       limit $4`,
      fallbackValues,
    ).catch(() => []);
  }

  return NextResponse.json({ jobs, scope, homeCountry, count: jobs.length });
}
