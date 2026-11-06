import { COMPETITORS } from "@/content/competitors";
import { competitorToMarkdown } from "@/lib/md-render";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const revalidate = 3600;

// Markdown twin of each competitor comparison, served publicly as
// /compare/<slug>.md via the rewrite in next.config.ts. "RoleSharp vs X" is
// the highest-citation-value content for AI answer engines — the comparison
// table survives verbatim in markdown, so rows get quoted directly.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const clean = slug.replace(/\.md$/, "");
  const competitor = COMPETITORS.find((c) => c.slug === clean);
  if (!competitor) return new Response("Not found", { status: 404 });
  return new Response(competitorToMarkdown(competitor, env.siteUrl), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      // Keep Google from indexing the twin as duplicate content; AI crawlers
      // ingest regardless of noindex (they only honor robots.txt).
      "X-Robots-Tag": "noindex",
    },
  });
}
