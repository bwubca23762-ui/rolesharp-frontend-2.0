// Render typed blog content to clean Markdown for AI answer engines.
//
// Why: LLM crawlers (GPTBot, ClaudeBot, PerplexityBot) extract markdown far
// more reliably and cheaply than HTML — the "markdown twin" pattern gives every
// post a /blog/<slug>.md mirror and powers /llms-full.txt. Tables and lists
// survive verbatim, so comparison rows stay citable.

import type { BlogPost, BlogSection } from "./blog";
import { competitorEvidenceLastChecked, rowHasCurrentEvidence, type Competitor } from "@/content/competitors";

function mdTable(t: { headers: string[]; rows: string[][] }): string {
  const head = `| ${t.headers.join(" | ")} |`;
  const sep = `| ${t.headers.map(() => "---").join(" | ")} |`;
  const rows = t.rows.map((r) => `| ${r.join(" | ")} |`);
  return [head, sep, ...rows].join("\n");
}

function mdSection(s: BlogSection): string {
  const parts: string[] = [];
  if (s.heading) parts.push(`## ${s.heading}`);
  if (s.paragraphs?.length) parts.push(...s.paragraphs);
  if (s.bullets?.length) {
    parts.push(s.bullets.map((b, i) => (s.ordered ? `${i + 1}. ${b}` : `- ${b}`)).join("\n"));
  }
  if (s.table) parts.push(mdTable(s.table));
  return parts.join("\n\n");
}

export function competitorToMarkdown(c: Competitor, siteUrl: string): string {
  const parts: string[] = [
    `# ${c.h1}`,
    "",
    `> ${c.verdict}`,
    "",
    `*Evidence last captured ${competitorEvidenceLastChecked(c)} · [Read on RoleSharp](${siteUrl}/compare/${c.slug})*`,
    "",
    c.intro,
    "",
    "## Feature comparison",
    "",
    mdTable({
      headers: ["Feature", "RoleSharp", c.name],
      rows: c.rows.map((r) => [
        rowHasCurrentEvidence(c, r) ? r.feature : `${r.feature} (not scored — evidence disputed or due for review)`,
        r.rolesharp,
        r.them,
      ]),
    }),
    "",
    `## Where ${c.name} wins`,
    "",
    ...c.themWins.map((w) => `**${w.heading}** — ${w.body}`),
    "",
    "## Where RoleSharp wins",
    "",
    ...c.usWins.map((w) => `**${w.heading}** — ${w.body}`),
    "",
    `## ${c.pricingHeading}`,
    "",
    c.pricingProse,
  ];
  if (c.faqs?.length) {
    parts.push("", "## FAQ", "");
    for (const [question, answer] of c.faqs) {
      parts.push(`### ${question}`, "", answer, "");
    }
  }
  if (c.evidence?.length) {
    parts.push("", "## Evidence and review status", "");
    for (const item of c.evidence) {
      parts.push(
        `- [${item.claim}](${item.sourceUrl}) — captured ${item.capturedAt}; review by ${item.reviewBy}; status: ${item.status}; volatility: ${item.volatility}.${item.notes ? ` ${item.notes}` : ""}`,
      );
    }
  }
  parts.push("", `*${c.sourcesNote}*`);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

export function postToMarkdown(post: BlogPost, siteUrl: string): string {
  const parts: string[] = [
    `# ${post.h1}`,
    "",
    `> ${post.answer}`,
    "",
    `*${post.category} · ${post.readMins} min read · Updated ${post.dateModified} · [Read on RoleSharp](${siteUrl}/blog/${post.slug})*`,
    "",
    ...post.sections.map(mdSection),
  ];
  if (post.faqs?.length) {
    parts.push("", "## FAQ", "");
    for (const [question, answer] of post.faqs) {
      parts.push(`### ${question}`, "", answer, "");
    }
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}
