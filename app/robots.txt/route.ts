import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// Custom robots.txt route (replaces app/robots.ts) so we can emit
// Content-Signal directives — Next's MetadataRoute.Robots can't express them.

// AI answer-engine crawlers we explicitly welcome so RoleSharp can be cited/
// suggested in AI search (ChatGPT, Claude, Perplexity, Google AI Overviews,
// Bing Copilot). All still blocked from /api/.
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-Web", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Bingbot", "Applebot-Extended",
];

// Private/thin routes — keep them out of the index and save crawl budget.
// /resumes is the authenticated saved-resume workspace: every /resumes/<id> URL
// renders a 200 client shell that then 401-redirects, which Google reads as a
// soft-404. Disallowing the whole segment stops the crawl waste at the source.
// The signed-in workflow routes (daily matches, application queue, campaign
// settings, mailbox connection) render the same auth-redirecting shell and
// additionally never contain public content; the password-reset and
// forgot-password flows are one-time user actions, not landing pages.
const DISALLOW = [
  "/api/", "/admin", "/admin/", "/dashboard", "/settings", "/tracker", "/support", "/resumes",
  "/dev",
  "/daily-matches", "/application-queue", "/campaign-settings", "/email-connection",
  "/reset-password", "/forgot-password",
];
// Public read-only JSON endpoint used by the homepage during client render.
// /api/me is account-state data and has no search or answer-engine value.
const ALLOW = ["/", "/api/countries"];

// Content Signals (contentsignals.org): we WANT search indexing, AI answers,
// and model training — public marketing content circulating in AI systems is
// distribution for RoleSharp, not leakage. User data never appears on public
// pages. Flip ai-train=no here if that stance changes.
const CONTENT_SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=yes";

function group(ua: string) {
  return [
    `User-Agent: ${ua}`,
    ...ALLOW.map((p) => `Allow: ${p}`),
    ...DISALLOW.map((p) => `Disallow: ${p}`),
    CONTENT_SIGNAL,
  ].join("\n");
}

export async function GET() {
  const body = [
    group("*"),
    ...AI_BOTS.map(group),
    `Sitemap: ${env.siteUrl}/sitemap.xml`,
    "",
  ].join("\n\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
