import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import StudentOfferCard from "@/components/StudentOfferCard";
import { FaqSection } from "../seo-blocks";
import JsonLd from "../json-ld";
import { env } from "@/lib/env";
import { Container, Section, Card, Button, Badge, MarketingShell } from "@/components/ui/primitives";
import { tailoredResumes } from "@/lib/limits";

// Standalone landing page for the student offer. The verification widget lives
// on /pricing and /settings; this page exists to rank for "free resume builder
// for students" and to give the student offer its own dedicated surface.
// All facts here mirror lib/student.ts and lib/entitlements.ts — keep them in
// sync if the offer changes.

export const metadata: Metadata = {
  title: "Free Resume Builder for Students",
  description:
    "Verified students get six months of Premium free, including tailored resumes, cover letters, interview prep, watermark-free PDF export, and all templates.",
  alternates: { canonical: "/students" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Free Resume Builder for Students — 6 Months of Premium Free",
    description:
      `Verify your university email once and get 6 months of RoleSharp Premium free. ${tailoredResumes(env.studentMonthlyLimit)} a month, cover letters, interview prep, watermark-free PDF, all templates.`,
    url: "/students",
  },
};

const INCLUDED = [
  [`${tailoredResumes(env.studentMonthlyLimit)} a month`, `Company- and role-specific resumes with the premium writing model — the same engine paying customers get, at a smaller monthly allowance than the paid plan's ${env.premiumMonthlyLimit}. Invite classmates to earn credits and build more.`],
  ["Cover letters", "Generate a cover letter matched to the same company, role, and job description as your resume."],
  ["Interview prep", "Likely questions and strong sample answers drawn from your actual resume — prepare, don't memorize."],
  ["Watermark-free PDF", "Download clean, ATS-parseable PDFs with no watermark. (Editable Word export is part of the paid plan — the student plan covers PDF.)"],
  ["Every template", "All resume templates unlocked, including the ones gated behind Premium on the free plan."],
  ["ATS score on every version", "See your score out of 100, missing keywords, and priority fixes as you build."],
];

const DOMAINS = [
  [".edu", "US institutions and schools worldwide on the .edu TLD"],
  [".edu.in / .edu.au / .edu.sg", "National education domains (edu.<cc>)"],
  [".ac.uk / .ac.jp / .ac.nz", "Academic domains (ac.<cc>) — UK, Japan, NZ, and more"],
];

const FAQS: [string, string][] = [
  ["What counts as a student email?", "An address ending in .edu, .edu.<country> (like .edu.in or .edu.au), or .ac.<country> (like .ac.uk or .ac.jp). Free-mail addresses (gmail, outlook, yahoo, etc.) are rejected automatically, even if you're a student."],
  ["How long does the offer last?", "6 months (180 days) of Premium from the moment you verify. After that you drop back to the free plan automatically — no charge, no card on file."],
  ["How many resumes can I make?", `${tailoredResumes(env.studentMonthlyLimit)} per rolling month on Student Premium. Paid Premium raises the allowance to ${tailoredResumes(env.premiumMonthlyLimit)} per rolling month and adds DOCX export, tool history, and full-market Daily Matches. You can use earned credits for additional generations.`],
  ["Do I need a credit card?", "No. Verification is a one-click email confirmation. Nothing is charged now or when the 6 months end."],
  ["Can I claim it more than once?", "No — one claim per student email, ever. If you have multiple accounts, the offer still only applies to one student email."],
  ["What happens to my resumes after 6 months?", `Nothing is deleted. You keep all saved resumes and drop to the free plan: ${tailoredResumes(env.freeMonthlyLimit)} a month, PDF export with a small watermark, and the checker stays free. Any credits you earned stay too.`],
  ["I graduated — can I still use it?", "The offer activates from a valid academic email and runs for 6 months regardless of graduation timing. Alumni also get a one-time 20% off their first paid period when the student Premium ends."],
  ["Can I build a student resume with no work experience?", "Yes. Start with coursework, academic projects, internships, volunteering, clubs, certifications, and measurable outcomes. The student resume builder organizes that evidence into an ATS-friendly structure and tailors it to the internship or entry-level job description."],
];

const STUDENT_GUIDES = [
  {
    href: "/blog/best-resume-format-for-freshers",
    title: "Best resume format for freshers",
    body: "For students starting from coursework, projects, clubs, and internships instead of full-time roles.",
  },
  {
    href: "/blog/tailor-student-resume-for-internships",
    title: "How to tailor one student resume for internships",
    body: "A cleaner way to adjust one base resume without rewriting it for every application.",
  },
  {
    href: "/blog/linkedin-headline-examples-job-seekers",
    title: "LinkedIn headline examples for job seekers",
    body: "Helpful when internship applications push recruiters from your resume to your profile.",
  },
] as const;

export default function StudentsPage() {
  const appLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "RoleSharp Student Premium",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "6 months of Premium free for verified students",
    },
    url: `${env.siteUrl}/students`,
  };

  return (
    <MarketingShell className="growth-page growth-students">
      <JsonLd data={appLd} />

      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-16 md:py-24">
          <Badge variant="primary" className="mb-4">Student offer</Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
            Studying or active university student?
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
            When enrollment is open, verify your university email to get{" "}
            {tailoredResumes(env.studentMonthlyLimit)} a month with the premium writing model, cover letters,
            interview prep, watermark-free PDF, and every template. No card is required.
          </p>
          <div className="flex flex-wrap gap-4">
            {env.studentOfferEnabled ? (
              <Button as="a" href="#claim" size="lg">
                Claim the student offer
              </Button>
            ) : (
              <Button as="a" href="/social-rewards" size="lg">
                Explore free interview credits
              </Button>
            )}
            <Button as="a" href="/pricing" variant="outline" size="lg">
              See full pricing
            </Button>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mt-4">
            Eligible: <b>.edu</b>, <b>.ac.uk</b>, <b>.edu.in</b> and similar academic domains. One claim per student email.
          </p>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              What you get
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Student Premium includes every Premium feature except editable Word export, tool history, and full-market Daily Matches.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INCLUDED.map(([title, body]) => (
              <Card key={title} variant="elevated" padding="md">
                <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">{title}</b>
                <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                  {body}
                </span>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm">
        <Container>
          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              How verification works
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Verification uses your school email. You do not need to upload a document.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              ["Enter your university email", "Use the address your school gave you. Free-mail addresses (gmail, outlook) are rejected automatically."],
              ["Click the link we send", "We email a confirmation link to your student address. It expires in 24 hours. No password, no card."],
              ["Premium activates instantly", "The moment you click, 6 months of Student Premium is live. Start building at /build."],
            ].map(([t, d], i) => (
              <Card key={t} variant="elevated" padding="md">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-sm font-bold mb-3">
                  {i + 1}
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">{t}</h3>
                <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                  {d}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Which emails qualify
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              School email addresses can use any of these academic domain formats.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOMAINS.map(([pattern, body]) => (
              <Card key={pattern} variant="elevated" padding="md">
                <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2" style={{ fontFamily: "var(--font-mono-ed, monospace)" }}>
                  {pattern}
                </b>
                <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                  {body}
                </span>
              </Card>
            ))}
          </div>
          <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-3xl mx-auto mt-6 text-center">
            Some academic-looking domains and alumni services are excluded. If your school email is rejected, contact support.
          </p>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm" id="claim" className="scroll-mt-20">
        <Container size="small">
          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              {env.studentOfferEnabled ? "Verify your student email" : "Enrollment status"}
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              {env.studentOfferEnabled ? "Sign in to verify your school email." : "New enrollments are paused. Existing access lasts until its scheduled end date."}
            </p>
          </div>
          <Suspense fallback={
            <Card padding="md">
              <Badge variant="primary" className="mb-3">Student offer</Badge>
              <h3 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">6 months of Student Premium. Free.</h3>
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mt-2">Loading...</p>
            </Card>
          }>
            <StudentOfferCard />
          </Suspense>
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card variant="dark" padding="lg" className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              After 6 months, choose a fixed-term Premium pass
            </h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto leading-relaxed">
              When Student Premium ends, the account returns to Free automatically with no surprise charge. Continue with a
              ${(env.priceMonthlyCents / 100).toLocaleString("en-US")} {env.daysMonthly}-day pass or ${(env.priceYearlyCents / 100).toLocaleString("en-US")} {env.daysYearly}-day pass, or use the one-time 20% alumni discount on the first paid pass. Paid passes never auto-renew.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button as="a" href="/pricing" variant="primaryInverse" size="lg">
                See pricing
              </Button>
              <Button as="a" href="/build" variant="outlineInverse" size="lg">
                Build a resume
              </Button>
              <Button as="a" href="/internships" variant="outlineInverse" size="lg">
                Find internships
              </Button>
            </div>
          </Card>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm">
        <Container>
          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Student guides that help most
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Good starting points if you are applying with limited experience or internship-heavy goals.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STUDENT_GUIDES.map((guide) => (
              <Link key={guide.href} href={guide.href} className="group block h-full">
                <Card variant="elevated" padding="md" className="h-full transition-colors hover:border-[var(--color-primary)]">
                  <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                    {guide.title}
                  </b>
                  <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                    {guide.body}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <FaqSection className="growth-faq" visible heading="Student offer — common questions" faqs={FAQS} />
    </MarketingShell>
  );
}
