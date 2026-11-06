import { env } from "@/lib/env";
import { TOOL_SPECS, type ToolSlug } from "@/lib/tool-specs";

export const runtime = "nodejs";
export const revalidate = 86400;

// Markdown twins of the core free tools, served publicly as
// /tools/<slug>.md via the rewrite in next.config.ts (App Router can't
// express a partial dynamic segment like [tool].md). Same pattern as the
// blog twins: token-cheap, extraction-perfect markdown for AI answer
// engines; humans keep the interactive page. Each tool page's
// <link rel="alternate" type="text/markdown"> points here.
export async function GET(_req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  const clean = tool.replace(/\.md$/, "") as ToolSlug;
  const spec = TOOL_SPECS[clean];
  if (!spec) return new Response("Not found", { status: 404 });

  const lines: string[] = [
    `# ${spec.title}`,
    "",
    `> ${spec.answer}`,
    "",
    `*Part of [RoleSharp](${env.siteUrl}) — free resume tools that keep your evidence honest. [Use the interactive version](${env.siteUrl}${spec.path}).*`,
    "",
    "## What it does",
    "",
    spec.description,
    "",
    "## How to use it",
    "",
    ...spec.steps.map((step, i) => `${i + 1}. ${step}`),
    "",
  ];

  if (spec.inputs.length) {
    lines.push("## Inputs", "", ...spec.inputs.map((input) => `- **${input.label}**: ${input.detail}`), "");
  }
  if (spec.outputs.length) {
    lines.push("## Output", "", ...spec.outputs.map((output) => `- ${output}`), "");
  }
  if (spec.limits) {
    lines.push("## Limits and honesty rules", "", spec.limits, "");
  }
  lines.push(
    "## Related tools",
    "",
    ...spec.related.map(([label, path]) => `- [${label}](${env.siteUrl}${path})`),
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      // Keep Google from indexing the twin as duplicate content; AI crawlers
      // ingest regardless of noindex (they only honor robots.txt).
      "X-Robots-Tag": "noindex",
    },
  });
}
