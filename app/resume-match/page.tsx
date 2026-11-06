import type { Metadata } from "next";
import ResumeMatchClient from "./resume-match-client";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Resume vs Job Description Match Checker — Free",
  description:
    "Paste your resume and a job description to see your match score, the keywords you cover, and exactly what's missing — free, no account needed.",
  alternates: {
    canonical: "/resume-match",
    // Markdown twin for AI crawlers (see app/tools-md/[tool]/route.ts)
    types: { "text/markdown": "/tools/resume-match.md" },
  },
  keywords: [
    "resume match checker", "resume job description match", "resume keyword checker",
    "ats match score", "resume vs job description", "job fit checker",
  ],
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Resume vs Job Description Match Checker — Free | RoleSharp",
    description: "See your match score, covered keywords, and exactly what's missing. Free, no account needed.",
    url: "/resume-match",
  },
};

const FAQS: [string, string][] = [
  ["How does the match score work?", "The checker extracts the requirements a job description repeats — skills, tools, and phrases — then measures how many of them your resume already evidences, weighted by how important each one is to the posting. It is the same matching engine our ATS score uses."],
  ["What should I paste?", "Paste the plain text of your resume (or upload it on the ATS Checker first and copy the result) and the full text of the job posting — including the requirements section, which carries the keywords."],
  ["Is my data stored?", "No. The match runs in memory and nothing is saved to any database. Close the page and the analysis is gone."],
  ["What is a good match score?", "75+ is excellent — you cover most of what the posting asks for. 55–74 is strong. Below 35 means the posting is looking for a very different profile, and tailoring your resume for that specific job is the fastest fix."],
  ["How do I improve a low score?", "Every missing keyword is a real requirement from the posting. Where you genuinely have that experience, work it into a bullet using the AI builder; where you don't, the honest answer is that this job may not be the right fit."],
];

export default function ResumeMatchPage() {
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map(([name, text]) => ({
          "@type": "Question",
          name,
          acceptedAnswer: { "@type": "Answer", text },
        })),
      }} />
      <JsonLd data={breadcrumbLd([
        { name: "Home", item: "/" },
        { name: "Resume Match Checker", item: "/resume-match" },
      ])} />
      <ResumeMatchClient faqs={FAQS} />
    </>
  );
}
