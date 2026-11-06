import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import { env } from "@/lib/env";
import { Container, Button, MarketingShell, PageHeader } from "@/components/ui/primitives";
import { FaqSection } from "../seo-blocks";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { tailoredResumes } from "@/lib/limits";

const FAQS: [string, string][] = [
  ["What is Daily Matches?", "Daily Matches sends at most one digest of up to ten newly seen, evidence-backed jobs per day in your campaign timezone. Fit measures compatibility and evidence confidence measures completeness; neither number predicts an interview. You can pause the digest and still inspect stored snapshots when delivery fails."],
  ["Where can RoleSharp Apply send a CV?", "Only to a literal recipient in a stored posting that explicitly tells candidates to apply by email. Multiple or unusual source-backed addresses require review. ATS-only listings, support/privacy contacts, guessed addresses, and edited recipients stay manual with the original application link."],
  ["What mailbox permission does RoleSharp request?", "Gmail uses identity plus gmail.send and offline access. Microsoft uses delegated Mail.Send and User.Read to confirm the connected account through /me. RoleSharp does not request inbox-read access, collect a mailbox password, or reuse your login permission for sending."],
  ["What if an application-email outcome is unknown?", "Unknown outcomes are not automatically resent because the provider might already have accepted the message. RoleSharp shows an unknown receipt and does not offer an automatic resend. Provider success is labeled accepted by provider — delivery unverified. Pause the campaign and use the original job link or contact the employer through a verified channel if needed."],
  ["Which tool should I start with?", "If you already have a resume, start with the old resume fixer. If you want full control or no AI, use the manual resume builder. If you are applying to a specific job, use the AI tailor with the company, country, role, and job description."],
  ["Can I check my LinkedIn profile too?", "Yes. Use the LinkedIn checker to paste your profile text and score your headline, About section, experience proof, skills visibility, and target-role keywords before recruiters see it."],
  ["Can I build a resume without AI?", "Yes. The manual resume builder lets you enter structured details, edit every section, preview the resume, and export through RoleSharp without relying on an outside AI API."],
  ["What does the old resume fixer check?", "It checks parseable structure, contact basics, skills, job keywords, bullet strength, and missing details. It also surfaces weak bullet examples so you know what to rewrite first."],
  ["How do I move from fixer to builder?", "After checking an old resume, use Rebuild in maker. RoleSharp carries useful resume text into the manual builder as editable starter content, so you can clean it up instead of starting blank."],
  ["How many resumes do I get for free?", `${env.freeMonthlyLimit} a month on the Free plan, on a rolling ${env.daysMonthly}-day window. Invite a friend who builds their first resume and you earn ${env.referralCreditReward} credit — up to ${env.referralMonthlyCap} credits per ${env.daysMonthly} days.`],
  ["What files can the checker read?", "PDF, DOCX, and TXT, up to 5 MB. We pull the text out of your file and score it — your document never gets posted anywhere."],
  ["What does Premium add?", `${tailoredResumes(env.premiumMonthlyLimit)} a month, our best AI writing, every template with no watermark, DOCX export, cover letters, interview prep, and a LinkedIn 'About' writer.`],
  ["Why do you ask for a country?", "Because hiring isn't the same everywhere. Your country sets the right date and location format, how much to lean on education, and the wording recruiters there expect."],
  ["My payment went through but Premium isn't active — what now?", `Email ${SUPPORT_EMAIL} from your account address. We can confirm the payment and switch Premium on by hand.`],
];

const TIPS = [
  {
    title: "Want controlled job workflows?",
    body: "Set a versioned profile, preview Daily Matches rules, or connect a separate sender for posting-backed application email.",
    href: "/campaign-settings",
    cta: "Set campaign rules",
  },
  {
    title: "Have an old resume?",
    body: "Start with the fixer. It scores what you have, shows missing keywords and weak bullets, then sends starter content to the maker.",
    href: "/resume-fixer",
    cta: "Open the fixer",
  },
  {
    title: "Need LinkedIn help too?",
    body: "Use the LinkedIn checker. It scores your headline, About section, recruiter keyword match, and proof signals like experience and Featured content.",
    href: "/linkedin-checker",
    cta: "Check LinkedIn",
  },
  {
    title: "Want full control?",
    body: "Use the manual builder. Add structured details yourself, edit the layout content, preview, and export without needing AI.",
    href: "/resume-builder",
    cta: "Open the builder",
  },
  {
    title: "On Premium?",
    body: "You’ve got DOCX, watermark-free exports, cover letters, interview prep, the LinkedIn writer, every template, and stronger AI tailoring.",
    href: "/pricing",
    cta: "See what's included",
  },
];

export const metadata: Metadata = {
  title: "Help and FAQ",
  description: "Answers on the old resume fixer, manual resume builder, AI tailoring, uploads, free limits, Premium, country targeting, and exports.",
  alternates: { canonical: "/help" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Help and FAQ",
    description: "Quick answers on RoleSharp tools, free limits, uploads, tailoring, Premium, and account issues.",
    url: "/help",
  },
};

export default function HelpPage() {
  return (
    <MarketingShell className="reading-shell">
      <section className="reading-masthead">
        <Container className="py-12 md:py-16">
          <PageHeader
            title="RoleSharp Help Center"
            description="Find help with resumes, exports, billing, account access, and job applications."
            actions={<><Button as="a" href="#help-faq">Browse common questions</Button><Button as="a" href="/contact" variant="outline">Contact support</Button></>}
            className="mb-0"
          />
        </Container>
      </section>

      <Container className="py-10 md:py-14">
        <section aria-labelledby="help-tools" className="reading-directory">
          <h2 id="help-tools" className="text-2xl font-bold">Find the right tool</h2>
          <ul className="reading-rows">
            {TIPS.map(({ title, body, href, cta }) => (
              <li key={href}>
                <a href={href} className="reading-row">
                  <span>
                    <span className="reading-row-heading">{cta}</span>
                    <span className="reading-row-caption">{title} {body}</span>
                  </span>
                  <span aria-hidden="true" className="reading-row-arrow">→</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[var(--muted-fg)]">
            Also see the <a href="/checker" className="reading-text-link">ATS resume checker</a>, the{" "}
            <a href="/students" className="reading-text-link">student offer</a>, or the{" "}
            <a href="/learn" className="reading-text-link">RoleSharp Academy</a>.
          </p>
        </section>
      </Container>

      <FaqSection id="help-faq" visible heading="Frequently asked questions" faqs={FAQS} />
    </MarketingShell>
  );
}
