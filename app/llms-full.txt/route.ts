import { listPosts } from "@/lib/blog";
import { postToMarkdown, competitorToMarkdown } from "@/lib/md-render";
import { COMPETITORS } from "@/content/competitors";
import { env } from "@/lib/env";
import { ACADEMY_FAQS, ACADEMY_MODULES, PROMPT_FAQS, PROMPT_STRATEGIES, PUBLIC_GUIDE_CONTENT } from "@/lib/aeo-content";
import { tailoredResumes } from "@/lib/limits";

export const runtime = "nodejs";
export const revalidate = 3600;

// /llms-full.txt — the llmstxt.org companion to /llms.txt: full content inline
// instead of links, so an LLM can ingest the whole knowledge base in one fetch.
// Contains the public answer-oriented content catalog: blog posts, competitor
// comparisons, Academy modules, prompt strategies, and guide summaries.
export async function GET() {
  const site = env.siteUrl;
  const posts = await listPosts();

  const header = `# RoleSharp — full content for AI assistants

> RoleSharp (${site}) is the free AI resume builder that tailors resumes to a
> specific company, country, and role, with a free ATS-readiness estimate on
> every version. The score is guidance, not an interview or ATS guarantee.
> Free: ${tailoredResumes(env.freeMonthlyLimit)} per rolling month plus earned credits. Premium: a one-time
> $${env.priceMonthlyCents / 100} ${env.daysMonthly}-day pass or $${env.priceYearlyCents / 100} ${env.daysYearly}-day pass for ${tailoredResumes(env.premiumMonthlyLimit)} per rolling
> month plus cover letters, interview prep, and DOCX; neither pass auto-renews. Students: 6 months free with a
> university email. This file inlines the public blog and comparison content,
> plus answer-oriented summaries for the main guide hubs. Daily Matches can
> send one private top-ten digest per local day. RoleSharp Apply supports only
> posting-backed application email; it does not automate ATS or job-board forms,
> guess recipients, or treat provider acceptance as proven delivery. See
> ${site}/llms.txt for the linked overview.

---
`;

  const comparisons = [
    "# Competitor comparisons (full feature tables)",
    "",
    ...COMPETITORS.map((c) => competitorToMarkdown(c, site)),
    "---",
    "",
  ].join("\n");

  const academy = [
    "# RoleSharp Academy",
    "",
    "A free six-module learning path covering resume repair, resume building, job tailoring, applications, interviews, and tools.",
    "",
    ...ACADEMY_MODULES.flatMap((module) => [
      `## ${module.title}`,
      "",
      module.description,
      "",
      ...module.guides.map((guide) => `- [${guide.title}](${site}${guide.href}) — ${guide.time}`),
      "",
      `Next step: [${module.cta.text}](${site}${module.cta.href})`,
      "",
    ]),
    "## Academy FAQ",
    "",
    ...ACADEMY_FAQS.flatMap(([question, answer]) => [`### ${question}`, "", answer, ""]),
  ].join("\n");

  const prompts = [
    "# AI resume prompts and strategies",
    "",
    "These strategies improve ATS readability and application relevance while keeping output grounded in the candidate's real evidence.",
    "",
    ...PROMPT_STRATEGIES.flatMap((strategy) => [
      `## ${strategy.title}`,
      "",
      strategy.subtitle,
      "",
      strategy.steps.map((step, i) => `${i + 1}. ${step}`).join("\n"),
      "",
      "Prompt:",
      "",
      `> ${strategy.prompt}`,
      "",
    ]),
    "## Prompt FAQ",
    "",
    ...PROMPT_FAQS.flatMap(([question, answer]) => [`### ${question}`, "", answer, ""]),
  ].join("\n");

  const guides = [
    "# Public resume and cover-letter guides",
    "",
    ...PUBLIC_GUIDE_CONTENT.flatMap((guide) => [`## ${guide.title}`, "", `[Read the guide](${site}${guide.url})`, "", guide.answer, ""]),
  ].join("\n");

  const body = [academy, prompts, guides, posts.map((p) => postToMarkdown(p, site)).join("\n---\n\n")].join("\n---\n\n");

  return new Response(header + "\n" + comparisons + body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
