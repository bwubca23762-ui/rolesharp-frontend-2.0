import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

export const metadata: Metadata = {
  title: "Career Summary Generator (Free)",
  description: "Turn your role history into a short career summary. Built only from the roles and skills you list, with nothing invented in between.",
  alternates: { canonical: "/career-summary-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Career Summary Generator (Free) | RoleSharp",
    description: "Turn your role history into a short career summary. Built only from the roles and skills you list, with nothing invented in between.",
    url: "/career-summary-generator",
  },
};

export default function Page() {
  return (
    <MicroGeneratorPage
      tool={"career"}
      eyebrow={"Free tool"}
      title={"Career summary generator"}
      intro={"List your roles, one per line. You get a short career narrative that reads across them, built only from what you listed."}
      cta={"Write my career summary"}
      premiumPerks={[
        { title: "Export as PDF", detail: "download the narrative clean, no watermark" },
        { title: "LinkedIn About writer", detail: "a first-person rewrite of the same evidence for your profile" },
        { title: "Unlimited imports", detail: "upload your resume and the roles fill themselves in" },
        { title: "DOCX export", detail: "editable Word copies of everything you generate" },
      ]}
      faqs={[
        ["How is this different from a resume summary?", "A resume summary targets one application. A career summary reads across several roles, which suits a LinkedIn About section or a profile at the top of a longer CV."],
        ["What format should the roles be in?", "One per line as Title, then Company, then Dates, separated by pipes. The same format the resume maker uses for education."],
        ["Will it explain a career gap for me?", "No. It describes the roles you list. A gap is yours to explain, and a generated excuse is easy for an interviewer to unpick."],
        ["Can I use this on LinkedIn?", "Yes. If you have a saved resume, the LinkedIn About tool writes a first-person version from the same evidence."],
      ]}
    />
  );
}
