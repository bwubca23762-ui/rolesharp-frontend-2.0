import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Resume Fixer & ATS Optimizer",
  description:
    "Use this free resume fixer and optimizer to find ATS problems, missing job keywords, weak bullets, and the highest-impact improvements.",
  alternates: {
    canonical: "/resume-fixer",
    // Markdown twin for AI crawlers (see app/tools-md/[tool]/route.ts)
    types: { "text/markdown": "/tools/resume-fixer.md" },
  },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    // Mirrors the page title — an og:title that differs from the tab title
    // made the shared card and the SERP disagree about the page's name.
    title: "Free Resume Fixer & ATS Optimizer | RoleSharp",
    description: "Check an existing resume, see what is lowering the score, and rebuild it with stronger structure and bullets.",
    url: "/resume-fixer",
  },
};

import ToolSeo from "../tool-seo";

// Pure workspace (owner decision 2026-10-18): the three-essay SEO wall that
// lived under the tool is gone. ToolSeo carries the WebApplication +
// BreadcrumbList schema; the tool itself is the page.
export default function ResumeFixerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo path="/resume-fixer" name="Free Resume Fixer" description="Free resume optimizer for finding ATS problems, missing job keywords, weak bullets, and the highest-impact improvements." />
    </>
  );
}
