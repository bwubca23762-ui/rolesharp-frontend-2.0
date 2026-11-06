import {
  Sparkles,
  FileText,
  Activity,
  Target,
  ChevronRight,
  Check,
  Download,
  Linkedin,
} from "@/app/icons";
import { Button, Container } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";

const FLAGSHIP_TOOLS = [
  {
    id: "tailor-engine",
    title: "AI Company & Role Tailoring Engine",
    eyebrow: "Resume tailoring",
    badge: "Most Popular",
    badgeTone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    description:
      "Transform your base resume for any target company and role in 30 seconds. Scans the job description, injects verified matching keywords, and optimizes every bullet for the ATS—without inventing fake achievements.",
    stats: [
      { label: "ATS Pass Rate", val: "96%" },
      { label: "Avg Score Lift", val: "+34 pts" },
      { label: "Generation Time", val: "< 30 sec" },
    ],
    features: [
      "Targeted to specific employer & country conventions",
      "Strict anti-hallucination guardrails",
      "Single-column ATS export guaranteed",
    ],
    cta: "Tailor Resume for a Job",
    href: "/build",
    icon: Target,
  },
  {
    id: "cover-letter",
    title: "Evidence-Grounded Cover Letter Generator",
    eyebrow: "High Conversion · Premium Tool",
    badge: "Premium",
    badgeTone: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
    description:
      "Say goodbye to generic, AI-sounding fluff letters that hiring managers instantly discard. RoleSharp synthesizes your actual resume accomplishments directly into a high-impact narrative that addresses the employer's exact requirements.",
    stats: [
      { label: "Recruiter Read Time", val: "45 sec" },
      { label: "Tone Accuracy", val: "Executive" },
      { label: "Format", val: "PDF & DOCX" },
    ],
    features: [
      "Draws exclusively from verified resume achievements",
      "Custom company pain-point hook",
      "No robotic clichés or filler sentences",
    ],
    cta: "Generate Custom Cover Letter",
    href: "/cover-letter-generator",
    icon: FileText,
  },
  {
    id: "live-interview",
    title: "Live Mock Interview with Real-Time Voice AI",
    eyebrow: "Flagship Experience · Voice Coaching",
    badge: "AI Voice",
    badgeTone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    description:
      "Rehearse behavioral and technical questions tailored specifically to the bullet points on your resume before you talk to the hiring team. Practice speaking out loud, get live pacing feedback, and master the STAR methodology.",
    stats: [
      { label: "Question Audio", val: "Live Voice" },
      { label: "Delivery Feedback", val: "Pacing & STAR" },
      { label: "Question Pool", val: "Role-Specific" },
    ],
    features: [
      "Voice AI speaks questions grounded in your background",
      "Live speech-to-text transcript & delivery coaching",
      "Technical trade-off & situational drill-downs",
    ],
    cta: "Start Live Voice Interview",
    href: "/interview-prep",
    icon: Sparkles,
  },
  {
    id: "auto-apply",
    title: "Controlled Auto Apply & Application Tracker",
    eyebrow: "High Velocity · Strict Safeguards",
    badge: "Automation",
    badgeTone: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    description:
      "Take your tailored resume and apply to verified matching roles at top companies with rigorous controls. Track every submission stage, monitor follow-up timers, and maintain an immutable delivery ledger.",
    stats: [
      { label: "Daily Safety Cap", val: "5 Verified/day" },
      { label: "Audit Ledger", val: "100% Tracked" },
      { label: "Source Backed", val: "Live Postings" },
    ],
    features: [
      "Verified posting-backed recipient matching",
      "Zero blind spamming or unapproved dispatches",
      "Integrated pipeline stages and follow-up alerts",
    ],
    cta: "Explore Auto Apply Workflow",
    href: "/auto-apply",
    icon: Activity,
  },
  {
    id: "daily-matches",
    title: "Daily Matches & Evidence-Backed Role Discovery",
    eyebrow: "Core Premium · Daily Opportunity Stream",
    badge: "Premium",
    badgeTone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    description:
      "Stop doom-scrolling noisy job boards. RoleSharp cross-references live employer postings against your verified skills, surfacing high-conviction roles with transparent match scores, missing keyword alerts, and instant 1-click tailoring.",
    stats: [
      { label: "Match Logic", val: "Evidence-Based" },
      { label: "Update Cadence", val: "Fresh Daily" },
      { label: "Tailor Handoff", val: "1-Click Ready" },
    ],
    features: [
      "Custom fit floor & minimum confidence thresholds",
      "Direct links to verified original employer postings",
      "Instant handoff into the AI Tailoring Engine",
    ],
    cta: "Explore Daily Matches",
    href: "/daily-matches",
    icon: Sparkles,
  },
] as const;

export function FlagshipToolsSuite() {
  return (
    <section id="flagship-tools" className="scroll-mt-20 border-b border-[var(--hairline)] py-8 md:py-12 bg-[var(--surface-2)]">
      <Container size="large">
        <Reveal variant="rise">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--primary)] shadow-2xs">
              <Sparkles size={13} className="text-amber-500" />
              <span>The Complete Career Acceleration Engine</span>
            </div>
            <h2 className="mt-4 text-[clamp(2rem,3.6vw,2.85rem)] font-extrabold! leading-[1.04]! tracking-[-0.035em]! text-[var(--fg)] text-balance">
              Your application, from first draft to interview.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted-fg)] md:text-lg md:leading-8">
              Choose a focused tool for each step: improve your resume, write a cover letter, practise interviews, and find relevant roles.
            </p>
          </div>
        </Reveal>

        {/* 2x2 Grid of Flagship Tools */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {FLAGSHIP_TOOLS.map((tool, idx) => {
            const Icon = tool.icon;
            const isFullWidth = tool.id === "daily-matches";
            return (
              <Reveal
                key={tool.id}
                variant="rise"
                delay={idx * 60}
                className={isFullWidth ? "md:col-span-2" : undefined}
              >
                <div
                  className={`flex h-full flex-col justify-between rounded-2xl border bg-[var(--surface)] p-5 shadow-sm transition-all duration-200 hover:shadow-lg ${
                    isFullWidth
                      ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/[0.04] via-[var(--surface)] to-teal-500/[0.04] hover:border-emerald-500"
                      : "border-[var(--border)] hover:border-[var(--primary)]"
                  }`}
                >
                  <div>
                    {/* Top Bar: Eyebrow + Badge */}
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-[var(--primary)]">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                          {tool.eyebrow}
                        </span>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${tool.badgeTone}`}>
                        {tool.badge}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 className="mt-3 text-lg font-bold tracking-tight text-[var(--fg)]">
                      {tool.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted-fg)]">
                      {tool.description}
                    </p>

                    {/* Key Capabilities List */}
                    <details className="mt-3">
                      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--primary)]">Capabilities</summary>
                    <ul className="space-y-2 pb-2 text-sm text-[var(--fg)]">
                      {tool.features.map((feat) => (
                        <li key={feat} className="flex items-center gap-2">
                          <Check size={13} className="shrink-0 text-emerald-800 dark:text-emerald-200" aria-hidden="true" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    </details>
                  </div>

                  {/* CTA Link */}
                  <div className="mt-4 border-t border-[var(--hairline)] pt-5">
                    <Button
                      as="a"
                      href={tool.href}
                      className="w-full justify-between"
                      rightIcon={<ChevronRight size={16} />}
                    >
                      {tool.cta}
                    </Button>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Supporting Power Drivers: DOCX Export & LinkedIn Optimizer */}
        <Reveal variant="rise" delay={200}>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
                  <Download size={18} />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-[var(--fg)]">Microsoft Word (.DOCX) & Clean PDF</h4>
                  <p className="text-xs text-[var(--muted-fg)]">100% editable, zero watermarks, ATS certified.</p>
                </div>
              </div>
              <a href="/resume-templates" className="text-xs font-bold text-[var(--primary)] hover:underline">
                View Formats →
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  <Linkedin size={18} />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-[var(--fg)]">LinkedIn Headline & Bio Optimizer</h4>
                  <p className="text-xs text-[var(--muted-fg)]">Turn your resume into an inbound recruiter magnet.</p>
                </div>
              </div>
              <a href="/linkedin-checker" className="text-xs font-bold text-[var(--primary)] hover:underline">
                Optimize Profile →
              </a>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
