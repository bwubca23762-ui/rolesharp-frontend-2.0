import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free LinkedIn Profile Checker",
  description:
    "Score your LinkedIn profile, find keyword gaps and weak sections, and get prioritized fixes that improve recruiter visibility.",
  alternates: {
    canonical: "/linkedin-checker",
    // Markdown twin for AI crawlers (see app/tools-md/[tool]/route.ts)
    types: { "text/markdown": "/tools/linkedin-checker.md" },
  },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "LinkedIn Checker | RoleSharp",
    description: "Score your LinkedIn profile, find weak sections, and see what to fix first.",
    url: "/linkedin-checker",
  },
};

import ToolSeo from "../tool-seo";

// Server-rendered SEO content below the (client) tool — crawlable depth for
// "linkedin profile checker" intent. FAQ + FAQPage JSON-LD live in page.tsx.
export default function LinkedinCheckerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo path="/linkedin-checker" name="LinkedIn Profile Checker" description="Score your LinkedIn profile: headline strength, About quality, keyword match, and recruiter-ready proof, with ranked fixes." />
    </>
  );
}
