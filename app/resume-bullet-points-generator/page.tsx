import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

export const metadata: Metadata = {
  title: "Resume Bullet Point Generator (Free, ATS-Ready)",
  description: "Turn plain descriptions of your work into resume bullets. Removes filler openers, flags missing numbers, and never invents a metric.",
  alternates: { canonical: "/resume-bullet-points-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Resume Bullet Point Generator (Free, ATS-Ready) | RoleSharp",
    description: "Turn plain descriptions of your work into resume bullets. Removes filler openers, flags missing numbers, and never invents a metric.",
    url: "/resume-bullet-points-generator",
  },
};

export default function Page() {
  return (
    <MicroGeneratorPage
      tool={"bullets"}
      eyebrow={"Free tool"}
      title={"Resume bullet points generator"}
      intro={"Write what you did in plain words, one line each. Every line comes back restructured, with filler openers removed and a note where a number would make it land harder."}
      cta={"Rewrite my bullets"}
      premiumPerks={[
        { title: "Export as PDF", detail: "download the rewritten bullets clean, no watermark" },
        { title: "Unlimited imports", detail: "upload your current resume so the bullets land straight in your draft" },
        { title: "DOCX export", detail: "hand an editable Word copy of your rewritten bullets to a mentor for review" },
        { title: "Cover letters", detail: "turn the same evidence into a tailored cover letter per job" },
      ]}
      faqs={[
        ["Will it add metrics to my bullets?", "Never. If a bullet has no number it is flagged so you can add the real one. Inventing a percentage is how people get caught in interviews."],
        ["What counts as a filler opener?", "Phrases like Responsible for, Worked on, and Duties included. They spend the first words of a bullet without saying what you delivered."],
        ["How many bullets should a role have?", "Three to five for a recent role, fewer as you go back. Each one should carry a result, not a responsibility."],
        ["Is this ATS-safe?", "Yes. Plain text bullets with standard punctuation parse cleanly, and the resume maker keeps that formatting through PDF and DOCX export."],
      ]}
    />
  );
}
