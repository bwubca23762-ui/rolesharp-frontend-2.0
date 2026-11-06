import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

export const metadata: Metadata = {
  title: "Reference Prep Note Generator",
  description:
    "Create a clear briefing for your job reference with the target role, relevant achievements and logistics. Built from your facts; free, no signup.",
  alternates: { canonical: "/reference-prep-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Reference Prep Generator | RoleSharp",
    description: "A prep one-pager your reference will actually thank you for. Free.",
    url: "/reference-prep-generator",
  },
};

export default function ReferencePrepPage() {
  return (
    <MicroGeneratorPage
      tool="reference"
      eyebrow="Free — no account"
      title="Reference prep generator"
      intro="Enter who your reference is, the role you are interviewing for, and what you hope they cover — get a short prep note you send them before the call. References do better when they are not surprised; the note reminds them of work they saw first-hand and says explicitly that they should skip anything they are unsure about."
      cta="Build my reference prep"
      faqs={[
        ["Is sending reference prep normal?", "Yes — recruiters expect it, and most references silently want it. A one-page reminder of what you worked on together, the role, and the logistics is a courtesy, not a script."],
        ["Can I tell my reference what to say?", "You can suggest topics; you cannot script them. The note is explicit about this: talking points are 'all your call — say only what you feel is true', and 'I did not work with them on that' is named as a good answer."],
        ["When should I send it?", "Right after the interview round where they were named — before the company contacts them. If nothing lands within a week, the note asks your reference to tell you so you can nudge the company."],
      ]}
    />
  );
}
