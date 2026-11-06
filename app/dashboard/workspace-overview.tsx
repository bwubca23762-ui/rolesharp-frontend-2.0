"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import {
  Activity,
  Bell,
  Briefcase,
  ChevronRight,
  Coins,
  Eraser,
  FileText,
  Github,
  Globe,
  LifeBuoy,
  Linkedin,
  RefreshCw,
  Scan,
  Shield,
  Sparkles,
  Target,
} from "@/app/icons";
import { JOB_COUNTRIES } from "@/lib/job-config";
import type { SessionData } from "@/app/session-context";

// Studio launchpad: one-click access to the tool surfaces from the workspace,
// so core tools stay reachable without the site nav. Tool count comes from
// JOB_COUNTRIES so the job-finder label can never drift.
const AI_STUDIO_LAUNCHPAD = [
  { href: "/build", title: "AI Resume Builder", badge: "Flagship AI", desc: "Tailor your resume to any company, role, and country.", icon: Sparkles },
  { href: "/checker", title: "ATS Resume Checker", badge: "5-Vendor X-Ray", desc: "Instant score plus Workday, Greenhouse, Lever, Taleo & iCIMS parser check.", icon: Shield },
  { href: "/resume-fixer", title: "Old Resume Fixer", badge: "Bullet Repair", desc: "Detect passive duty bullets and rewrite them with quantified metrics.", icon: FileText },
  { href: "/resume-match", title: "JD Match & Compare", badge: "Free Tool", desc: "Compare your resume against any job description for missing keywords.", icon: Target },
  { href: "/linkedin-checker", title: "LinkedIn Profile Audit", badge: "Recruiter SEO", desc: "Score your headline, About section, and searchable recruiter keywords.", icon: Linkedin },
  { href: "/cover-letter-generator", title: "Cover Letter Studio", badge: "Grounded", desc: "Generate a role-specific cover letter grounded in your resume proof.", icon: FileText },
  { href: "/interview-prep", title: "Voice AI Mock Interview", badge: "Live Voice", desc: "Practice role-specific behavioral & technical questions with STAR coaching.", icon: Sparkles },
  { href: "/jobs", title: `${JOB_COUNTRIES.length}-Country Job Finder`, badge: "Live Postings", desc: "Search fresh listings with fit badges, salary filters, and 1-click tailoring.", icon: Globe },
  { href: "/ats-xray", title: "ATS Parser X-Ray", badge: "X-Ray", desc: "See the exact table an ATS extracts from your resume, line by line, plus the JD frequency matrix.", icon: Scan },
  { href: "/github-resume", title: "GitHub Resume Compiler", badge: "Dev Tool", desc: "Turn public repos into evidence bullets and move between resume.json, RenderCV YAML, and ATS text.", icon: Github },
  { href: "/ai-humanizer", title: "AI-Touch Remover", badge: "Bot-Stealth", desc: "Strip AI watermarks, cliché verbs, and robotic tails — with before/after human-score verification.", icon: Eraser },
] as const;

type Application = { id: string; status: string; follow_up_at?: string | null };
type Campaign = { id: string; mode: string; status: string };
type Match = { id: string; status: string };
type ApplicationPackage = { id: string; status: string };
type Attempt = { id: string; status: string };
type Connection = { id: string; provider: string; verified_sender?: string; status: string };
type Ticket = { id: string; status: string };

type Snapshot = {
  applications: Application[] | null;
  campaigns: Campaign[] | null;
  matches: Match[] | null;
  packages: ApplicationPackage[] | null;
  attempts: Attempt[] | null;
  connections: Connection[] | null;
  tickets: Ticket[] | null;
  unavailable: string[];
  checkedAt: string;
};

// The overview names sources in prose, not by their API key.
const SOURCE_LABELS: Record<string, string> = {
  applications: "applications",
  campaigns: "campaigns",
  matches: "Daily Matches",
  packages: "application queue",
  attempts: "send ledger",
  connections: "email connections",
  tickets: "support tickets",
};
const label = (key: string) => SOURCE_LABELS[key] ?? key;

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export default function WorkspaceOverview({ session }: { session: SessionData }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    // One request, not seven. Each of the old per-source fetches re-ran
    // currentUser() and took its own connection from a pool of ten, so a single
    // dashboard open could occupy most of the pool. /api/workspace-overview
    // does the same seven reads server-side under one auth check and reports
    // per-source failures in `unavailable`, so the degradation behaviour below
    // is unchanged: a source that is down stays null and names itself.
    const response = await fetch("/api/workspace-overview", { cache: "no-store" }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    const list = <T,>(value: unknown): T[] | null => (Array.isArray(value) ? (value as T[]) : null);
    const ALL_SOURCES = ["applications", "campaigns", "matches", "packages", "attempts", "connections", "tickets"];
    setSnapshot({
      applications: list<Application>(payload?.applications),
      campaigns: list<Campaign>(payload?.campaigns),
      matches: list<Match>(payload?.matches),
      packages: list<ApplicationPackage>(payload?.packages),
      attempts: list<Attempt>(payload?.attempts),
      connections: list<Connection>(payload?.connections),
      tickets: list<Ticket>(payload?.tickets),
      // If the batch request itself failed there is no per-source detail to
      // report, so every source is unavailable rather than silently empty.
      unavailable: payload
        ? (Array.isArray(payload.unavailable) ? payload.unavailable : []).map(label)
        : ALL_SOURCES.map(label),
      checkedAt: new Date().toISOString(),
    });
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards = useMemo(() => {
    const applications = snapshot?.applications;
    const campaigns = snapshot?.campaigns;
    const matches = snapshot?.matches;
    const packages = snapshot?.packages;
    const attempts = snapshot?.attempts;
    const connections = snapshot?.connections;
    const tickets = snapshot?.tickets;
    const now = Date.now();
    const dueFollowUps = applications?.filter((item) => item.follow_up_at && new Date(item.follow_up_at).getTime() <= now).length ?? 0;
    const interviews = applications?.filter((item) => item.status === "interview").length ?? 0;
    const dailyCampaign = campaigns?.find((item) => item.mode === "daily_matches" && item.status === "active")
      ?? campaigns?.find((item) => item.mode === "daily_matches");
    const applyCampaign = campaigns?.find((item) => item.mode === "role_apply" && item.status === "active")
      ?? campaigns?.find((item) => item.mode === "role_apply");
    const reviewPackages = packages?.filter((item) => item.status === "review_required").length ?? 0;
    const acceptedAttempts = attempts?.filter((item) => item.status === "provider_accepted").length ?? 0;
    const uncertainAttempts = attempts?.filter((item) => ["unknown", "needs_user"].includes(item.status)).length ?? 0;
    const activeConnection = connections?.find((item) => item.status === "active");
    const openTickets = tickets?.filter((item) => item.status === "open").length ?? 0;

    return [
      {
        label: "Application tracker",
        value: applications ? `${applications.length} tracked` : "Unavailable",
        detail: applications ? `${interviews} interviewing — ${dueFollowUps} follow-up${dueFollowUps === 1 ? "" : "s"} due` : "Retry to refresh your tracker summary.",
        href: "/tracker",
        icon: Briefcase,
        badge: dueFollowUps > 0 ? `${dueFollowUps} due` : "Up to date",
        badgeVariant: dueFollowUps > 0 ? "warning" as const : "success" as const,
      },
      {
        label: "Daily Matches",
        value: matches ? `${matches.length} eligible` : "Unavailable",
        detail: dailyCampaign ? `Campaign ${titleCase(dailyCampaign.status)}` : "Set your roles, locations, and delivery time.",
        href: dailyCampaign ? "/daily-matches" : "/campaign-settings",
        icon: Sparkles,
        badge: dailyCampaign ? titleCase(dailyCampaign.status) : "Set up",
        badgeVariant: dailyCampaign?.status === "active" ? "success" as const : "outline" as const,
      },
      {
        label: "Auto Apply queue",
        value: packages ? (reviewPackages ? `${reviewPackages} to review` : "Queue clear") : "Unavailable",
        detail: uncertainAttempts > 0
          ? `${uncertainAttempts} outcome${uncertainAttempts === 1 ? "" : "s"} need review — never auto-resend`
          : applyCampaign
            ? `${acceptedAttempts} provider-accepted — campaign ${titleCase(applyCampaign.status)}`
            : "Configure a review-first campaign when you are ready.",
        href: reviewPackages || attempts?.length ? "/application-queue" : "/campaign-settings",
        icon: Activity,
        badge: uncertainAttempts > 0 ? "Review" : applyCampaign ? titleCase(applyCampaign.status) : "Not set up",
        badgeVariant: uncertainAttempts > 0 ? "warning" as const : applyCampaign?.status === "active" ? "success" as const : "outline" as const,
      },
      {
        label: "Email connection",
        value: connections ? (activeConnection ? `${titleCase(activeConnection.provider)} connected` : "Not connected") : "Unavailable",
        detail: activeConnection?.verified_sender || "Connect only the sender you want RoleSharp to use.",
        href: "/email-connection",
        icon: Shield,
        badge: activeConnection ? "Active" : "Set up",
        badgeVariant: activeConnection ? "success" as const : "outline" as const,
      },
      {
        label: "Account & plan",
        value: session.premium ? "Premium" : "Free plan",
        detail: `${session.remaining ?? 0} of ${session.limit ?? 0} resumes left — email ${session.emailVerified ? "verified" : "unverified"}`,
        href: "/settings",
        icon: FileText,
        badge: session.emailVerified ? "Secure" : "Verify email",
        badgeVariant: session.emailVerified ? "success" as const : "warning" as const,
      },
      {
        label: "Notifications",
        value: "History & settings",
        detail: "Service, security, product, and career notices with a durable archive.",
        href: "/notifications",
        icon: Bell,
        badge: "Inbox",
        badgeVariant: "outline" as const,
      },
      {
        label: "Support",
        value: tickets ? `${openTickets} open` : "Unavailable",
        detail: openTickets ? "Your conversation remains available in the support center." : "Help with billing, login, exports, or workflow setup.",
        href: "/support",
        icon: LifeBuoy,
        badge: openTickets ? "In progress" : "Help center",
        badgeVariant: openTickets ? "primary" as const : "outline" as const,
      },
    ];
  }, [session, snapshot]);

  return (
    <section className="mb-10" aria-labelledby="workspace-overview-heading">
      {/* 8-Tool AI Career Studio Launchpad */}
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.13em] text-[var(--color-primary)]">AI Career Studio</p>
            <h2 className="mt-1 text-xl font-bold! tracking-[-0.025em]! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Launch any tool from your workspace</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button as="a" href="/salaries" variant="outline" size="compact" leftIcon={<Coins size={14} />}>Salary Estimator</Button>
            <Button as="a" href="/tools" variant="ghost" size="compact">All career tools →</Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AI_STUDIO_LAUNCHPAD.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card key={tool.href} variant="interactive" padding="sm" className="group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]">
                      <Icon size={17} />
                    </span>
                    <Badge variant="primary">{tool.badge}</Badge>
                  </div>
                  <h3 className="mt-2.5 text-sm font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)] group-hover:text-[var(--color-primary)]">
                    <a href={tool.href} className="no-underline">{tool.title}</a>
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{tool.desc}</p>
                </div>
                <a
                  href={tool.href}
                  className="mt-3 inline-flex items-center justify-between border-t border-[var(--hairline)] pt-2 text-xs font-semibold text-[var(--color-primary)] no-underline"
                >
                  <span>Open tool</span>
                  <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </a>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--color-primary)]">At a glance</p>
          <h2 id="workspace-overview-heading" className="mt-1 text-2xl font-bold! tracking-[-0.025em]! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Your job search workspace</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Real account, search, application, and support state in one place.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing} leftIcon={<RefreshCw size={14} />}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {!snapshot ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5, 6].map((item) => <Card key={item} className="p-5"><Skeleton variant="card" /></Card>)}
        </div>
      ) : (
        <>
          {snapshot.unavailable.length > 0 && (
            <div className="mb-4 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[#78350F]" role="status">
              Some summaries are temporarily unavailable: {snapshot.unavailable.join(", ")}. Existing account data was not changed.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} padding="none" className="group overflow-hidden hover:-translate-y-0.5 hover:border-[var(--color-primary-200)] hover:shadow-[var(--shadow-md)]">
                  <a href={item.href} className="flex min-h-[176px] flex-col p-5 no-underline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--color-primary)]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><Icon size={19} /></span>
                      <Badge variant={item.badgeVariant}>{item.badge}</Badge>
                    </div>
                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{item.label}</p>
                    <div className="mt-1 flex items-center gap-2"><strong className="min-w-0 flex-1 truncate text-xl text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{item.value}</strong><ChevronRight size={18} className="shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5" /></div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{item.detail}</p>
                  </a>
                </Card>
              );
            })}
          </div>
          <p className="mt-3 text-right text-xs text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]">Checked {new Date(snapshot.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
        </>
      )}
    </section>
  );
}
