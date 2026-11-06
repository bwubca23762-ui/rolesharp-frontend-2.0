import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

const DESCRIPTION = "Draft a professional resignation letter using your notice period and last working day. Review the details before sending. Free to use.";

export const metadata: Metadata = {
  title: "Resignation Letter Generator (Free)",
  description: DESCRIPTION,
  alternates: { canonical: "/resignation-letter-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Resignation Letter Generator (Free) | RoleSharp",
    description: DESCRIPTION,
    url: "/resignation-letter-generator",
  },
};

export default function Page() {
  return (
    <MicroGeneratorPage
      tool={"resignation"}
      eyebrow={"Free tool"}
      title={"Resignation letter generator"}
      intro={"Fill in the details and get a letter you can send. It counts your last working day from your notice period, says nothing you did not write, and flags what only you can check."}
      cta={"Write my resignation letter"}
      premiumPerks={[
        { title: "Export as PDF", detail: "download the letter letterhead-ready, no watermark" },
        { title: "DOCX export", detail: "an editable Word copy of the letter, if HR asks for changes" },
        { title: "Cover letters", detail: "the same evidence becomes a tailored cover letter for the next role" },
        { title: "Priority support", detail: "real help from a human when you need it" },
      ]}
      faqs={[
        ["Do I have to give a reason for leaving?", "In most places, no. This letter leaves it out unless you write one, because a resignation letter goes into a personnel file and can be forwarded to people you will never meet. A short, factual letter is the safer document."],
        ["How long should a resignation letter be?", "Short. It needs your role, that you are resigning, and your last working day. Everything else is optional. The brief tone here produces exactly those three things."],
        ["How is my last working day worked out?", "It counts your notice period forward from the date on the letter, so two weeks from 16 August is 30 August. Check your contract: notice often runs from the day the resignation is accepted rather than the day you hand it in, and the tool says so."],
        ["Should I say why I am leaving, or complain about the job?", "Not here. A resignation letter is a record, not a conversation. If you have things to raise, an exit interview or a separate conversation is where they belong, and neither one is filed against your name forever."],
        ["Can I send this by email?", "Yes, and most people do. Paste the letter into the email body, put your name and last working day in the subject, and send it to your manager with HR copied if that is your company's process."],
        ["What if I do not know my notice period?", "Check your contract or offer letter before sending anything. Leave the field blank and the tool will tell you the letter has no last working day in it, which is the one date the reader actually needs."],
      ]}
    />
  );
}
