import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

const DESCRIPTION = "Draft a respectful salary counteroffer using your offer, target and real achievements. Review an email with no invented market claims. Free to use.";

export const metadata: Metadata = {
  title: "Salary Negotiation Email Generator (Free)",
  description: DESCRIPTION,
  alternates: { canonical: "/salary-negotiation-script" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Salary Negotiation Email Generator (Free) | RoleSharp",
    description: DESCRIPTION,
    url: "/salary-negotiation-script",
  },
};

export default function Page() {
  return (
    <MicroGeneratorPage
      tool={"negotiation"}
      eyebrow={"Free tool"}
      title={"Salary negotiation email"}
      intro={"Your offer, your target, your results in your own words — the draft asks for the gap directly, anchors on what you bring, and stays flexible on the package. If your target is not above the offer, it writes the confirm-and-timeline letter instead, because negotiating against yourself is theater."}
      cta={"Draft my negotiation email"}
      premiumPerks={[
        { title: "Export as PDF", detail: "keep the draft with your offer paperwork" },
        { title: "Offer tracking", detail: "record the offered base on the application when it lands" },
        { title: "Cover letters", detail: "the same evidence becomes the tailored cover letter that got you here" },
        { title: "Priority support", detail: "real help from a human when you need it" },
      ]}
      faqs={[
        ["Should I negotiate every offer?", "You should always have the conversation when you have a real reason — market range, an offer in hand, or scope beyond what was advertised. What you should not do is invent a gap: if the offer already meets your target, the honest move is to confirm and get the package in writing, which is what this tool writes."],
        ["What number do I ask for?", "One you can anchor: a published range for the role and market, the number in the original posting, or another offer. RoleSharp's salary pages compute real ranges from live postings with published pay — start there."],
        ["Will negotiating cost me the offer?", "A respectful, specific counter almost never does; rescinding over a polite negotiation is itself a signal about the employer. What costs offers is vagueness — 'is that negotiable?' with no number. This draft puts the number on the table with the reasoning next to it."],
        ["Is it only about base salary?", "Base is where you anchor, because bonuses and equity compound from it. The draft keeps the package door open — signing bonus, earlier review, equity — so the recruiter can meet you where their band allows."],
        ["Should I put my real results in?", "Yes — yours, not aspirational ones. The value lines are the reason the counter is reasonable, and you may be asked to defend them in the same conversation. Type only what you can prove."],
      ]}
    />
  );
}
