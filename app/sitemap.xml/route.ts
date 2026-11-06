import { NextRequest } from "next/server";
import { q } from "@/lib/db";
import { listPosts } from "@/lib/blog";
import { env } from "@/lib/env";
import { publicRequestOrigin } from "@/lib/request-origin";
import { sitemapIndexXml, xmlResponse, type SitemapUrl } from "@/lib/sitemap-xml";

export const runtime = "nodejs";
export const revalidate = 3600;

// Sitemap INDEX → named segments in app/sitemaps/[name]/route.ts.
// Cheap by design (a COUNT and two MAX queries) so /sitemap.xml responds
// instantly even on a cold server right after deploy.
//
// Index-level <lastmod> is emitted only for segments with a real change
// signal (blog, jobs) — it tells crawlers which segment files to refetch.
export async function GET(req: NextRequest) {
  const base = env.production && !env.localDevMode
    ? env.siteUrl
    : publicRequestOrigin({
        headers: req.headers,
        fallbackHost: req.nextUrl.host,
        fallbackProtocol: req.nextUrl.protocol,
      }) ?? req.nextUrl.origin;

  const [posts, jobsSeen] = await Promise.all([
    listPosts().catch(() => []),
    q<{ last: string | null }>("select max(last_seen_at)::date::text as last from jobs").catch(() => [{ last: null }]),
  ]);

  const blogLast = posts
    .map((p) => new Date(p.dateModified))
    .filter((d) => Number.isFinite(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const sitemaps: SitemapUrl[] = [
    { loc: `${base}/sitemaps/pages.xml` },
    { loc: `${base}/sitemaps/blog.xml`, lastmod: blogLast ? blogLast.toISOString().split("T")[0] : undefined },
    { loc: `${base}/sitemaps/jobs.xml`, lastmod: jobsSeen[0]?.last ?? undefined },
    { loc: `${base}/sitemaps/hubs.xml` },
    { loc: `${base}/sitemaps/salaries.xml` },
    { loc: `${base}/sitemaps/interview-questions.xml` },
    { loc: `${base}/sitemaps/people.xml` },
  ];

  return xmlResponse(sitemapIndexXml(sitemaps));
}
