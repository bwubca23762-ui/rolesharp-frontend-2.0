import { NextRequest } from "next/server";
import { SEO_COMPANIES_PER, hasDb, listSeoHubs, q } from "@/lib/db";
import { listPosts } from "@/lib/blog";
import { env } from "@/lib/env";
import { COMPETITORS } from "@/content/competitors";
import { KEY_LOCALES } from "@/lib/locales";
import { JOB_COUNTRIES } from "@/lib/job-config";
import { bankEligibleRoles } from "@/lib/interview-bank";
import { indexableSites } from "@/lib/db/personal-sites";
import { listDevIndexableSites } from "@/lib/local-dev-store";
import { publicRequestOrigin } from "@/lib/request-origin";
import { urlsetXml, xmlResponse, type SitemapUrl } from "@/lib/sitemap-xml";
import { candidatesPromise } from "@/lib/salary-pages";

export const runtime = "nodejs";
export const revalidate = 3600;

// Segmented sitemaps, one file per page TYPE (see /sitemap.xml for the index).
// Named segments make Google Search Console a per-template diagnostic: submit
// the index once and GSC reports indexed/discovered counts for each segment,
// so "blog is 90% indexed but resume pairs are at 40%" is visible at a glance.
//
//   /sitemaps/pages.xml      product, SEO landing, content, locale, compare
//   /sitemaps/blog.xml       posts (real lastmod from dateModified)
//   /sitemaps/jobs.xml       country job + internship hubs (real ingestion lastmod)
//   /sitemaps/hubs.xml       company/role hub + detail pages
//
// Google ignores <priority>/<changefreq>, so we don't emit them; <lastmod> is
// emitted only where we have a true modification signal (never stamped
// "today", never a hash-derived pseudo date).

const STATIC_PATHS = [
  // Core tools
  "", "/resume-fixer", "/checker", "/resume-maker", "/linkedin-checker", "/jobs", "/internships", "/internship-reports",
  "/build/help", "/checker/help", "/linkedin-checker/help", "/resume-maker/help", "/resume-fixer/help",
  // SEO landing pages
  "/resume-builder", "/resume-templates", "/resume-examples", "/resume-tailoring",
  "/cover-letter-generator", "/cover-letter-examples", "/cover-letter-templates", "/interview-prep",
  "/resume-translator", "/auto-apply",
  // Free standalone generators. Each answers one search and needs no account,
  // so a crawl path is the entire point of them existing.
  "/resume-summary-generator", "/resume-bullet-points-generator",
  "/work-experience-generator", "/career-summary-generator",
  "/resignation-letter-generator", "/skill-gap",
  // Ink & Signal new tools (2026-08)
  "/resume-match", "/resume-compare", "/salaries", "/interview-questions",
  "/cv-converter", "/linkedin-headline-generator", "/cover-letter-analyzer", "/free-certifications",
  // Standalone generators (2026-09): shipped without sitemap coverage, so the
  // only crawl path was the tools catalogue.
  "/thank-you-note-generator", "/salary-negotiation-script",
  // Lifecycle expansion (2026-10-21)
  "/offer-calculator",
  // Lifecycle expansion P4c (2026-10-22)
  "/tools/job-clipper",
  // Lifecycle expansion P4d (2026-10-22)
  "/30-60-90-day-plan-generator", "/reference-prep-generator",
  // Open-source & stealth tool batch (2026-10-27): GitHub compiler, parser
  // X-Ray, AI-touch remover — each needs its own crawl path.
  "/ats-xray", "/github-resume", "/ai-humanizer",
  // Link-earning assets (2026-07-18)
  "/tools/embed-ats-checker", "/resume-keyword-report-2026", "/job-search-guide", "/career-map",
  // Link-building hubs (2026-08): tools catalogue, press kit, integrations, affiliate
  "/tools", "/press", "/integrations", "/affiliate",
  // Content & info. /careers 308s to /roles (next.config.ts) and /u is emitted
  // by the people segment — neither belongs here: a sitemap must list final,
  // canonical, non-duplicated URLs only.
  "/prompts", "/learn", "/blog", "/pricing", "/compare", "/students",
  "/about", "/contact", "/help", "/job-alerts", "/social-rewards",
  // Legal
  "/privacy", "/terms", "/refund",
];

async function segment(name: string, base: string): Promise<SitemapUrl[] | null> {

  if (name === "pages") {
    return [
      ...STATIC_PATHS.map((p) => ({ loc: `${base}${p}` })),
      ...KEY_LOCALES.map((l) => ({ loc: `${base}/${l.slug}` })),
      ...COMPETITORS.map((c) => ({ loc: `${base}/compare/${c.slug}` })),
    ];
  }

  if (name === "blog") {
    const posts = await listPosts();
    return posts.map((p) => {
      const d = new Date(p.dateModified);
      return {
        loc: `${base}/blog/${p.slug}`,
        lastmod: Number.isFinite(d.getTime()) ? d.toISOString().split("T")[0] : undefined,
      };
    });
  }

  if (name === "jobs") {
    // Real freshness signal: when the ingestor last saw a listing per country.
    const seen = await q<{ code: string; jobs_last: string; internships_last: string | null }>(
      `select lower(country_code) as code,
              max(last_seen_at)::date::text as jobs_last,
              (max(last_seen_at) filter (where 'internship' = any(string_to_array(replace(coalesce(job_type,''),' ',''), ','))))::date::text as internships_last
       from jobs
       where expires_at is null or expires_at >= now()
       group by 1`,
    ).catch(() => [] as { code: string; jobs_last: string; internships_last: string | null }[]);
    const jobsLastByCode = new Map(seen.map((r) => [r.code, r.jobs_last]));
    const internshipsLastByCode = new Map(seen.map((r) => [r.code, r.internships_last]));
    return [
      ...JOB_COUNTRIES.filter((c) => !hasDb() || jobsLastByCode.has(c.code.toLowerCase())).map((c) => ({
        loc: `${base}/jobs/${c.slug}`,
        lastmod: jobsLastByCode.get(c.code.toLowerCase()),
      })),
      ...JOB_COUNTRIES.filter((c) => !hasDb() || (internshipsLastByCode.has(c.code.toLowerCase()) && internshipsLastByCode.get(c.code.toLowerCase()))).map((c) => ({
        loc: `${base}/internships/${c.slug}`,
        lastmod: internshipsLastByCode.get(c.code.toLowerCase()) ?? undefined,
      })),
    ];
  }

  if (name === "hubs") {
    const [hubs, availableCountryHubs] = await Promise.all([
      listSeoHubs().catch(() => ({ companies: [], roles: [] })),
      q<{ code: string }>(
        `select lower(country_code) as code
         from (
           select country_code
           from companies
           where website is not null and sector is not null and country_code is not null
           order by tier, (website is null), (sector is null), country_code, id
           limit $1
         ) curated
         where lower(country_code) = any($2)
         group by lower(country_code)`,
        [SEO_COMPANIES_PER, ["us", "gb", "ca", "au", "in", "de", "sg", "ae"]],
      ).catch(() => []),
    ]);
    return [
      { loc: `${base}/companies` },
      { loc: `${base}/roles` },
      ...availableCountryHubs.map(({ code }) => ({ loc: `${base}/companies/${code}` })),
      ...hubs.companies.map((slug) => ({ loc: `${base}/companies/${slug}` })),
      ...hubs.roles.map((slug) => ({ loc: `${base}/roles/${slug}` })),
    ];
  }

  if (name === "people") {
    // Only sites whose owner set `indexable`. indexableSites() puts that in the
    // WHERE, so a published-but-unlisted page cannot reach a crawler through
    // here — the sitemap is the one file where that mistake is irreversible.
    const sites = env.localDevMode
      ? await listDevIndexableSites().catch(() => [])
      : await indexableSites().catch(() => []);
    return [
      { loc: `${base}/u` },
      ...sites.map((site) => ({ loc: `${base}/u/${site.handle}`, lastmod: site.published_at?.slice(0, 10) })),
    ];
  }

  if (name === "salaries") {
    // Prebuilt role×market salary pages. Only pages the route actually
    // generates appear here — the sitemap and the route share one candidate
    // memo (6h TTL), so a URL in this segment can never 404. The flip side of
    // the TTL: a page that loses its sample leaves this segment within 6h,
    // not within the sitemap's own 1h revalidate window.
    const candidates = await candidatesPromise(150).catch(() => []);
    return candidates.map((candidate) => ({
      loc: `${base}/salaries/${candidate.roleSlug}/${candidate.countryCode.toLowerCase()}`,
      lastmod: candidate.lastSeen?.slice(0, 10),
    }));
  }

  if (name === "interview-questions") {
    // Role interview banks. The route is force-dynamic and 404s below 4
    // questions, so this segment lists exactly the roles the bank builder
    // considers eligible (>=4 required skills) — the same eligibility rule
    // the route enforces, keeping every sitemap URL live. Slugs come from the
    // maintained roles table; a DB miss returns an empty segment, not stale
    // URLs.
    const roles = await bankEligibleRoles(200).catch(() => []);
    return roles.map((role) => ({ loc: `${base}/interview-questions/${role.slug}` }));
  }

  // Retain the old sitemap endpoint temporarily as a valid empty document so
  // Google can process the retired segment without receiving another 404.
  if (/^resumes-[12]$/.test(name)) {
    return [];
  }

  return null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const clean = name.replace(/\.xml$/, "");
  const base = env.production && !env.localDevMode
    ? env.siteUrl
    : publicRequestOrigin({
        headers: req.headers,
        fallbackHost: req.nextUrl.host,
        fallbackProtocol: req.nextUrl.protocol,
      }) ?? req.nextUrl.origin;
  const urls = await segment(clean, base);
  if (!urls) return new Response("Not found", { status: 404 });
  return xmlResponse(urlsetXml(urls));
}
