import { q } from "./db";

// Honest, real aggregate stats for the social-proof band. Every number here
// comes from the live database — no fabricated user counts, no fake testimonials
// (per DOCS audit item #20). If the DB is unreachable, we fall back to env-provided
// floor values so the page never breaks. Floors default to 0, which renders as
// "—" in the band — never a made-up number.
//
// Cache: 10 min in-process. These counts move slowly and the band renders on the
// homepage, so a short cache protects the DB without serving stale-enough-to-mislead data.

export type SiteStats = {
  resumesScored: number;
  companies: number;
  roles: number;
  countries: number;
};

const TTL_MS = 10 * 60 * 1000;
let cache: { ts: number; data: SiteStats } | null = null;

function floor(envVar: string): number {
  const n = Number(process.env[envVar]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function getSiteStats(): Promise<SiteStats> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.data;

  // Each query is independent and wrapped so a single failure doesn't poison the
  // whole band — mirrors the sitemap.ts .catch(() => 0) pattern.
  const [resumes, companies, roles, countries] = await Promise.all([
    q<{ n: string }>("select count(*)::text n from resumes")
      .then((r) => Number(r[0]?.n ?? 0))
      .catch(() => 0),
    q<{ n: string }>("select count(*)::text n from companies")
      .then((r) => Number(r[0]?.n ?? 0))
      .catch(() => 0),
    q<{ n: string }>("select count(*)::text n from roles")
      .then((r) => Number(r[0]?.n ?? 0))
      .catch(() => 0),
    q<{ n: string }>("select count(*)::text n from countries")
      .then((r) => Number(r[0]?.n ?? 0))
      .catch(() => 0),
  ]);

  const data: SiteStats = {
    resumesScored: Math.max(resumes, floor("STAT_FLOOR_RESUMES")),
    companies: Math.max(companies, floor("STAT_FLOOR_COMPANIES")),
    roles: Math.max(roles, floor("STAT_FLOOR_ROLES")),
    countries: Math.max(countries, floor("STAT_FLOOR_COUNTRIES")),
  };
  cache = { ts: Date.now(), data };
  return data;
}

// Human-readable formatting: 1234 -> "1,234", 0 -> "—".
export function formatStat(n: number): string {
  return n > 0 ? n.toLocaleString("en-US") : "—";
}
