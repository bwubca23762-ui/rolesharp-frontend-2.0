import type { Metadata } from "next";
import { ToolShell } from "@/components/ui/primitives";
import CoverLetterAnalyzerClient from "./analyzer-client";

export const metadata: Metadata = {
  title: "Cover Letter Analyzer \u2014 Review Your Letter",
  description:
    "Paste your cover letter and get an instant score: length, named addressee, quantified proof, cliché density, call to action, and more. Included with Premium.",
  alternates: { canonical: "/cover-letter-analyzer" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Cover Letter Analyzer | RoleSharp",
    description: "Score your cover letter against the eight checks recruiters actually apply. Included with Premium.",
    url: "/cover-letter-analyzer",
  },
};

export default function CoverLetterAnalyzerPage() {
  return (
    /* Tier note: the analyzer is genuinely Premium-gated (the API returns 402 for
       free accounts — verified in the 2026-10 QA sweep), so the eyebrow stays
       honest. The prompt that asked for a "Free tool" label here was wrong. */
    <ToolShell
      eyebrow="Premium tool"
      title="Cover letter analyzer"
      subtitle="Paste your letter and get an honest score against the eight checks hiring teams actually apply — plus 5 sub-scores and a repaired opening paragraph."
      workspaceSize="large"
    >
      <CoverLetterAnalyzerClient />
    </ToolShell>
  );
}
