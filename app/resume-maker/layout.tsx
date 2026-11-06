import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Manual Resume Builder",
  description:
    "Create an ATS-friendly resume with structured fields, live preview, readiness scoring, and PDF or DOCX export. No AI required.",
  alternates: { canonical: "/resume-maker" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Manual Resume Builder | RoleSharp",
    description: "Build your own ATS-friendly resume manually, edit every section, preview live, and export PDF or DOCX.",
    url: "/resume-maker",
  },
};

import ToolSeo from "../tool-seo";

// Server-rendered SEO content below the (client) tool — crawlable depth for
// "manual resume builder / make a resume yourself" intent. FAQ + FAQPage
// JSON-LD live in page.tsx.
export default function ResumeMakerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo path="/resume-maker" name="Free Manual Resume Builder" description="Build an ATS-friendly resume yourself with structured fields, live preview, readiness scoring, and free PDF/DOCX export." />
    </>
  );
}
