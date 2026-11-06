import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Resume Builder for Any Job",
  description:
    "Build an ATS-friendly resume for a specific company and job. Match keywords, strengthen your experience, and export to PDF or DOCX.",
  alternates: {
    canonical: "/resume-builder",
    // Markdown twin for AI crawlers (see app/tools-md/[tool]/route.ts)
    types: { "text/markdown": "/tools/resume-builder.md" },
  },
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "AI Resume Builder — Tailored to Any Company & Role | RoleSharp",
    description: "Create a company- and role-specific resume that beats the ATS. Free to start, no card required.",
    url: "/build",
  },
};

import ToolSeo from "../tool-seo";

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo path="/build" name="AI Resume Builder" description="Build an ATS-optimized resume tailored to the exact company, role, and job description, with keyword scoring before you apply." />
    </>
  );
}
