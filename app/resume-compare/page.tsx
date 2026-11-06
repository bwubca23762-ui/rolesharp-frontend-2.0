import type { Metadata } from "next";
import VersionCompareClient from "./version-compare-client";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Compare Resume Versions — Which One Fits Better?",
  description:
    "Paste two resume versions and one job description. See which scores higher, what each covers that the other misses, and shared gaps. Free.",
  openGraph: { type: "website" as const, url: "/resume-compare", images: ["/opengraph-image"] },
  alternates: {
    canonical: "/resume-compare",
    // Markdown twin for AI crawlers (see app/tools-md/[tool]/route.ts)
    types: { "text/markdown": "/tools/resume-compare.md" },
  },
};

const FAQS: [string, string][] = [
  ["When should I compare two resumes?", "When you've tailored the same resume for two different jobs, or when you want to see if your edits actually improved the match. The delta tells you whether the rewrite helped or hurt."],
  ["Is either version stored?", "No. Both are analyzed in memory and discarded."],
  ["What does 'missing from both' mean?", "Requirements the job description repeats that neither version covers. These are the keywords to add — where your history genuinely supports them — before submitting either version."],
];

export default function ResumeComparePage() {
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
        { name: "Compare Resume Versions", item: "/resume-compare" },
      ])} />
      <VersionCompareClient faqs={FAQS} />
    </>
  );
}
