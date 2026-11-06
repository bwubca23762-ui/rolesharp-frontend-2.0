import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

const DESCRIPTION = "Draft a post-interview thank-you note using a specific discussion point, the role and a clear next-step question. Free to use without an account.";

export const metadata: Metadata = {
  title: "Post-Interview Thank You Note Generator (Free)",
  description: DESCRIPTION,
  alternates: { canonical: "/thank-you-note-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Thank You Note Generator (Free) | RoleSharp",
    description: DESCRIPTION,
    url: "/thank-you-note-generator",
  },
};

export default function Page() {
  return (
    <MicroGeneratorPage
      tool={"thankyou"}
      eyebrow={"Free tool"}
      title={"Post-interview thank you note"}
      intro={"The note is not about politeness — it is one more proof you listened. Fill in who you met and one specific thing you discussed; the generator says it back cleanly and asks about the next step without nagging."}
      cta={"Write my thank-you note"}
      premiumPerks={[
        { title: "Export as PDF", detail: "a clean copy you can attach or print" },
        { title: "Follow-up drafts", detail: "quiet applications in your tracker get follow-up notes too" },
        { title: "Interview practice", detail: "rehearse the next round against your own resume" },
        { title: "Priority support", detail: "real help from a human when you need it" },
      ]}
      faqs={[
        ["Should I send a thank-you note after an interview?", "Yes — short and specific beats long and generic. A three-sentence note that references one real moment from the conversation does more than a paragraph of enthusiasm, because it proves you were present rather than performing."],
        ["How soon should I send it?", "Same day if you can, within 24 hours at the outside. The panel stops absorbing new impressions quickly; a note that arrives while the conversation is still fresh gets associated with it."],
        ["Email or handwritten?", "Email. It arrives while the decision is being made, and every interviewer can forward it to the rest of the panel. Handwritten is a nice second channel, not a substitute."],
        ["What if I interviewed with a panel?", "Send each person a note that names something specific from their part of the conversation. The one specific thing is what makes each note feel written, and this generator exists to make that cheap."],
        ["Can the note hurt me?", "Only if it invents things. This tool writes nothing you did not type — if you discussed month-end reconciliation, the note mentions month-end reconciliation, and nothing else."],
      ]}
    />
  );
}
