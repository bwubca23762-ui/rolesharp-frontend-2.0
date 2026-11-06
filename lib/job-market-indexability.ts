import { unstable_cache } from "next/cache";
import { hasDb, q } from "./db";

export type JobMarketKind = "jobs" | "internships";

const cachedAvailability = unstable_cache(
  async (countryCode: string, kind: JobMarketKind): Promise<boolean | null> => {
    if (!hasDb()) return null;
    try {
      const internshipClause = kind === "internships"
        ? "and 'internship' = any(string_to_array(replace(lower(coalesce(job_type,'')),' ',''), ','))"
        : "";
      const rows = await q<{ available: boolean }>(
        `select exists(
           select 1 from jobs
           where lower(country_code)=lower($1)
             and (expires_at is null or expires_at >= now())
             ${internshipClause}
         ) as available`,
        [countryCode],
      );
      return rows[0]?.available ?? false;
    } catch {
      // A transient database failure must not accidentally deindex a market.
      return null;
    }
  },
  ["job-market-indexability-v1"],
  { revalidate: 3600 },
);

export function jobMarketIndexability(countryCode: string, kind: JobMarketKind) {
  return cachedAvailability(countryCode.toLowerCase(), kind);
}
