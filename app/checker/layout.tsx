import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free ATS Resume Checker",
  description:
    "Upload a PDF, DOCX, or TXT resume for a free ATS score, job-description keyword match, and prioritized fixes.",
  alternates: {
    canonical: "/checker",
    // Markdown twin for AI crawlers (see app/tools-md/[tool]/route.ts)
    types: { "text/markdown": "/tools/ats-resume-checker.md" },
  },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Free ATS Resume Checker — Score Your Resume | RoleSharp",
    description: "Get an ATS score, job-description keyword match, missing terms, and priority fixes. Free, no card required.",
    url: "/checker",
  },
};

import ToolSeo from "../tool-seo";

export default function CheckerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo path="/checker" name="Free ATS Resume Checker" description="Free resume score checker, grader, and keyword scanner for PDF, DOCX, or TXT resumes, with job-description matching and prioritized fixes." />
    </>
  );
}
