import { getPost } from "@/lib/blog";
import { postToMarkdown } from "@/lib/md-render";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const revalidate = 3600;

// Markdown twin of each blog post, served publicly as /blog/<slug>.md via the
// rewrite in next.config.ts (App Router can't express a partial dynamic
// segment like [slug].md, so the route lives at /blog-md/<slug>).
// AI crawlers get token-cheap, extraction-perfect markdown; humans keep the
// HTML page. Each post's <link rel="alternate" type="text/markdown"> and
// /llms.txt point here.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const clean = slug.replace(/\.md$/, "");
  const post = await getPost(clean);
  if (!post) return new Response("Not found", { status: 404 });
  return new Response(postToMarkdown(post, env.siteUrl), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      // Keep Google from indexing the twin as duplicate content; AI crawlers
      // ingest regardless of noindex (they only honor robots.txt).
      "X-Robots-Tag": "noindex",
    },
  });
}
