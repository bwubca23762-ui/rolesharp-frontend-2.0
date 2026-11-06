import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

export const metadata: Metadata = {
  title: "Resume Summary Generator (Free, No Sign-Up)",
  description: "Write a professional resume summary from your own experience. Free, no account, and it never invents experience you do not have.",
  alternates: { canonical: "/resume-summary-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Resume Summary Generator (Free, No Sign-Up) | RoleSharp",
    description: "Write a professional resume summary from your own experience. Free, no account, and it never invents experience you do not have.",
    url: "/resume-summary-generator",
  },
};

export default function Page() {
  return (
    <MicroGeneratorPage
      tool={"summary"}
      eyebrow={"Free tool"}
      title={"Resume summary generator"}
      intro={"Paste your role, your years, and your strongest results. You get a summary built from those exact facts. If you leave a field empty it is left out rather than filled with something generic."}
      cta={"Write my summary"}
      premiumPerks={[
        { title: "Export as PDF", detail: "download the finished summary letterhead-ready, no watermark" },
        { title: "Unlimited imports", detail: "upload your resume and pull real results in instead of retyping them" },
        { title: "DOCX export", detail: "keep an editable Word copy of everything you generate" },
        { title: "Tailored resumes", detail: `${5}/month AI-tailored to a named employer, watermark-free` },
      ]}
      faqs={[
        ["Do I need an account?", "No. The generator runs without signing up."],
        ["Will it invent experience for me?", "No. It restructures what you paste and drops any clause it has no input for. Anything missing is reported instead of written for you, because a claim you cannot defend in an interview is worse than a shorter summary."],
        ["How long should a resume summary be?", "Two to four lines. Long enough to name your role, your level, and one result worth remembering."],
        ["What do I do with the result?", "Copy it into the resume maker, or run a full ATS check to see how the rest of the document reads."],
      ]}
    />
  );
}
