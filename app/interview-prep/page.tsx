import type { Metadata } from "next";
import { FaqSection } from "../seo-blocks";
import JsonLd from "../json-ld";
import ResumeToolPanel from "@/components/ResumeToolPanel";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { Button, ToolShell } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Interview Practice from Your Resume",
  description: "Practice interview answers using your resume. Free accounts get one five-question session monthly; Premium adds more questions and voice coaching.",
  alternates: { canonical: "/interview-prep" },
  openGraph: { type: "website", images: ["/opengraph-image"], title: "Interview Practice — Questions from Your Resume", description: "Rehearse with your own evidence, review feedback, and prepare your next answer.", url: "/interview-prep" },
};

const FAQS: [string, string][] = [
  ["Is this a live interview assistant?", "No. RoleSharp is for rehearsal before an interview. It does not listen to or coach a live call."],
  ["What is included for free?", "One five-question typed practice session each calendar month, with evidence-focused feedback. Reading the questions does not use the allowance; submitting your first answer does."],
  ["What does Premium add?", "Premium includes the full question set and recorded voice coaching when the voice service is available. A credit can also unlock a full session. You can always use typed answers."],
  ["How is my answer reviewed?", "Typed feedback checks evidence overlap and answer structure using rules. The score is a rehearsal aid, not an employer assessment or a prediction of a hiring decision."],
  ["Can I practise different interviewer perspectives?", "After generating your questions, open the panel practice section for screener, hiring-manager, and executive perspectives. The evidence card collects stories and numbers already in your resume."],
];

export default function InterviewPrepPage() {
  return (
    <ToolShell eyebrow="Interview practice" title="Get your practice questions" subtitle="Rehearse answers based on your own experience. One five-question typed session each month is free." actions={<Button as="a" href="/interview-questions" variant="outline">Question bank</Button>}>
      <JsonLd data={breadcrumbLd([{ name: "Home", item: `${env.siteUrl}/` }, { name: "Interview Practice", item: `${env.siteUrl}/interview-prep` }])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "RoleSharp Interview Practice", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: `${env.siteUrl}/interview-prep`, offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "One five-question typed practice session per month; paid upgrades available" } }} />
      <FaqSection faqs={FAQS} visible={false} />
      <div id="prep" className="grid w-full min-w-0 scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(15rem,.8fr)] lg:items-start lg:gap-10">
        <ResumeToolPanel kind="interview" heading="Choose a resume to practise from" description="Select the version closest to the job you’re preparing for." actionLabel="Generate my questions" />
        <section aria-labelledby="practice-guide" className="min-w-0 border-t border-[var(--hairline)] pt-4">
          <h2 id="practice-guide" className="text-xl font-semibold tracking-tight">How practice works</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--muted-fg)]">
            <li>Choose the saved resume you used to apply.</li>
            <li>Answer one question at a time in your own words.</li>
            <li>Use the feedback to decide what evidence to add.</li>
          </ol>
          <div className="mt-5 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
            {FAQS.map(([question, answer]) => (
              <details key={question}>
                <summary className="min-h-11 cursor-pointer content-center py-2.5 text-sm font-semibold leading-6">{question}</summary>
                <p className="pb-4 text-sm leading-6 text-[var(--muted-fg)]">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </ToolShell>
  );
}
