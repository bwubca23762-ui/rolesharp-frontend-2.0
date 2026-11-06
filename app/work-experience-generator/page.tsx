import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

export const metadata: Metadata = {
  title: "Work Experience Generator for a Job Posting",
  description: "Paste a job posting and your experience. See which of your bullets match the posting, in order, and exactly which requirements nothing supports.",
  alternates: { canonical: "/work-experience-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Work Experience Generator for a Job Posting | RoleSharp",
    description: "Paste a job posting and your experience. See which of your bullets match the posting, in order, and exactly which requirements nothing supports.",
    url: "/work-experience-generator",
  },
};

export default function Page() {
  return (
    <MicroGeneratorPage
      tool={"experience"}
      eyebrow={"Free tool"}
      title={"Work experience generator"}
      intro={"Paste the posting and your own bullets. Your experience comes back ranked against what the posting actually asks for, plus an honest list of the requirements nothing you wrote supports yet."}
      cta={"Match my experience"}
      premiumPerks={[
        { title: "Export as PDF", detail: "save the ranked match as a clean worksheet, no watermark" },
        { title: "Unlimited imports", detail: "upload your resume instead of pasting bullets line by line" },
        { title: "Tailored resumes", detail: "5/month AI-tailored to the exact posting you pasted" },
        { title: "DOCX export", detail: "editable copies of every tailored resume" },
      ]}
      faqs={[
        ["Does it write experience I do not have?", "No, and that is the point. Requirements with no supporting evidence are listed as gaps. Filling those in for you is how a resume stops being defensible."],
        ["What should I paste as the posting?", "The requirements or responsibilities section is enough. More text gives a better match."],
        ["Why is a bullet ranked low?", "It shares few meaningful words with the posting. That does not make it a bad bullet, only a less relevant one for this application."],
        ["What do I do about the gaps?", "If you have done the work, add it in your own words. If you have not, apply anyway and be ready to talk about the closest thing you have done."],
      ]}
    />
  );
}
