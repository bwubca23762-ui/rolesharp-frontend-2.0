"use client";
import { useEffect, useState, Suspense, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import {
  Badge,
  Button,
  Card,
  Container,
  WorkspaceShell,
} from "@/components/ui/primitives";
import { User, Coins, Shield, Sparkles, Settings as SettingsIcon, CreditCard, GraduationCap, ChevronRight, Bell, Activity, Grid, Target } from "../icons";
import StudentOfferCard from "@/components/StudentOfferCard";
import AuthRequiredState from "@/components/AuthRequiredState";
import { useSession } from "../session-context";
import { planLabel } from "@/lib/plan-label";
import Skeleton from "@/components/ui/Skeleton";
import type { SessionData } from "../session-context";

// Overview is the landing tab, so it stays in this module. Every other panel is
// only reachable by an explicit tab click, and shipping all of them up front is
// what made this route's JS an order of magnitude larger than /admin, which
// already lazy-loads its views the same way.
const BillingPanel = dynamic(() => import("./panels/billing"), { loading: () => <PanelLoading label="billing" /> });
const CreditsPanel = dynamic(() => import("./panels/credits"), { loading: () => <PanelLoading label="credits" /> });
const AccountPanel = dynamic(() => import("./panels/account"), { loading: () => <PanelLoading label="account details" /> });
const SecurityPanel = dynamic(() => import("./panels/security"), { loading: () => <PanelLoading label="security settings" /> });
const NotificationPreferences = dynamic(() => import("./panels/notifications"), { loading: () => <PanelLoading label="notification preferences" /> });
const ApplicationSettings = dynamic(() => import("./panels/application"), { loading: () => <PanelLoading label="application controls" /> });
const WebsitePanel = dynamic(() => import("./panels/website"), { loading: () => <PanelLoading label="personal website" /> });
const JobPreferencesPanel = dynamic(() => import("./panels/job-preferences"), { loading: () => <PanelLoading label="job matching preferences" /> });

// Skeleton placeholders (not a text line): the panel shells reserve the same
// block of space the real panel occupies, so the swap-in produces no layout
// shift — the CLS fix the audit asked for.
function PanelLoading({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={`Loading ${label}`}>
      <Skeleton variant="card" height="120px" />
      <div className="mt-4 space-y-3">
        <Skeleton variant="card" height="64px" />
        <Skeleton variant="card" height="64px" />
      </div>
    </div>
  );
}

const SETTINGS_TABS = ["overview", "billing", "credits", "account", "security", "notifications", "application", "matching", "website", "student"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

const TAB_DETAILS: Array<{ id: SettingsTab; label: string; description: string; icon: typeof SettingsIcon }> = [
  { id: "overview", label: "Overview", description: "Account at a glance", icon: SettingsIcon },
  { id: "billing", label: "Billing", description: "Access term and payment history", icon: CreditCard },
  { id: "credits", label: "Credits", description: "Balance and invites", icon: Sparkles },
  { id: "account", label: "Account", description: "Email and verification", icon: User },
  { id: "security", label: "Security", description: "Password and account safety", icon: Shield },
  { id: "notifications", label: "Notifications", description: "In-app notice preferences", icon: Bell },
  { id: "application", label: "Application", description: "Auto-apply, email, and campaign controls", icon: Activity },
  { id: "matching", label: "Job matching", description: "Deal breakers for Daily Matches and Apply", icon: Target },
  { id: "website", label: "Personal website", description: "Publish a resume as a public page", icon: Grid },
  { id: "student", label: "Student plan", description: "Education email offer", icon: GraduationCap },
];

export default function Settings() {
  const { session: me, loading: sessionLoading, error: sessionError, refreshSession } = useSession();
  const [activeTab, setActiveTab] = useState<SettingsTab>("overview");
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const setTabFromUrl = () => {
      const requested = new URLSearchParams(window.location.search).get("tab") as SettingsTab | null;
      setActiveTab(requested && SETTINGS_TABS.includes(requested) ? requested : "overview");
    };
    setTabFromUrl();
    window.addEventListener("popstate", setTabFromUrl);
    return () => window.removeEventListener("popstate", setTabFromUrl);
  }, []);
  // Redirect unauthenticated users from an effect (not during render).
  useEffect(() => {
    if (!sessionLoading && !retrying && !sessionError && me && !me.loggedIn) {
      // Preserve the query string: the student verification flow lands here
      // as /settings?student=activated, and a bare next=/settings would strip
      // the confirmation banner the return URL exists to show.
      const search = typeof window !== "undefined" ? window.location.search : "";
      window.location.href = `/login?next=${encodeURIComponent(`/settings${search}`)}`;
    }
  }, [me, retrying, sessionError, sessionLoading]);

  if ((sessionLoading && !me) || retrying) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] py-10 md:py-16" aria-busy="true">
        <Container size="small">
          <Card className="p-6 md:p-8">
            <Badge variant="default">Account</Badge>
            <h1 className="text-3xl font-extrabold! text-[var(--color-text)] mt-4 mb-2">Loading settings…</h1>
            <p className="text-[var(--color-text-muted)]">Checking your secure session and account details.</p>
          </Card>
        </Container>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] py-10 md:py-16">
        <Container size="small">
          <div role="alert">
            <Card className="p-6 md:p-8">
              <Badge variant="default">Settings unavailable</Badge>
              <h1 className="text-3xl font-extrabold! text-[var(--color-text)] mt-4 mb-3">Your settings did not load.</h1>
              <p className="text-[var(--color-text-muted)] mb-6">We couldn&apos;t load your account settings. Your account is safe—retry the connection or sign in again.</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={async () => { setRetrying(true); await refreshSession(); setRetrying(false); }}>Retry</Button>
                <Button as="a" href="/login?next=/settings" variant="outline">Sign in again</Button>
              </div>
            </Card>
          </div>
        </Container>
      </main>
    );
  }

  if (me && !me.loggedIn) {
    return (
      <AuthRequiredState
        title="Log in to manage your account"
        description="Review access terms, payment history, credits, email verification, password controls, and account deletion from one private settings workspace."
        actionLabel="Continue to login"
        nextPath="/settings"
      />
    );
  }

  function selectTab(event: MouseEvent<HTMLAnchorElement>, tab: SettingsTab) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    if (tab === activeTab) return;

    const url = new URL(window.location.href);
    if (tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setActiveTab(tab);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
  }

  const currentTab = TAB_DETAILS.find((tab) => tab.id === activeTab) || TAB_DETAILS[0];

  return (
    <WorkspaceShell
      className="w-full min-w-0"
      eyebrow="Account"
      title="Settings"
      description="Manage your account, billing, and job search preferences."
      actions={<Button as="a" href="/dashboard" variant="outline">Dashboard</Button>}
    >
        <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Settings sections" className="min-w-0 border-y border-[var(--border)] py-2 lg:sticky lg:top-24">
            <div className="grid grid-cols-2 gap-x-2 sm:grid-cols-3 lg:grid-cols-1">
              {TAB_DETAILS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <a
                    key={tab.id}
                    href={settingsHref(tab.id)}
                    onClick={(event) => selectTab(event, tab.id)}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    className="flex min-h-11 min-w-0 items-center gap-2 border-s-2 border-transparent px-2.5 py-2 text-sm font-medium text-[var(--muted-fg)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)] aria-[current=page]:border-[var(--primary)] aria-[current=page]:bg-[var(--surface-2)] aria-[current=page]:text-[var(--fg)] motion-reduce:transition-none"
                  >
                    <Icon aria-hidden="true" size={16} className="shrink-0" />
                    <span>{tab.label}</span>
                  </a>
                );
              })}
            </div>
          </nav>

          <section aria-labelledby="settings-section-title" className="min-w-0">
            <div className="mb-5">
              <h2 id="settings-section-title" className="text-2xl font-bold! font-[family-name:var(--font-display)]! tracking-tight text-[var(--fg)]">{currentTab.label}</h2>
              <p className="mt-1 text-sm text-[var(--muted-fg)]">{currentTab.description}</p>
            </div>
            <div className="space-y-6">
              {activeTab === "overview" && <SettingsOverview me={me} onSelect={selectTab} />}
              {activeTab === "billing" && <BillingPanel me={me} onChange={refreshSession} />}
              {activeTab === "credits" && <CreditsPanel me={me} />}
              {activeTab === "account" && <AccountPanel userId={me?.userId} email={me?.email} onChange={refreshSession} />}
              {activeTab === "security" && <SecurityPanel hasPassword={me?.hasPassword !== false} />}
              {activeTab === "notifications" && <NotificationPreferences />}
              {activeTab === "application" && <ApplicationSettings />}
              {activeTab === "matching" && <JobPreferencesPanel />}
              {activeTab === "website" && <WebsitePanel />}
              {activeTab === "student" && (
                <Suspense fallback={<StudentOfferFallback />}>
                  <StudentOfferCard />
                </Suspense>
              )}
            </div>
          </section>
        </div>
    </WorkspaceShell>
  );
}

function StudentOfferFallback() {
  return (
    <Card className="p-6 md:p-8" aria-busy="true">
      <Badge variant="default">Student plan</Badge>
      <h3 className="mt-4 text-2xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Checking student eligibility…</h3>
      <p className="mt-2 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Loading your education-email status.</p>
    </Card>
  );
}

function settingsHref(tab: SettingsTab) {
  return tab === "overview" ? "/settings" : `/settings?tab=${tab}`;
}

function SettingsOverview({ me, onSelect }: { me: SessionData | null; onSelect: (event: MouseEvent<HTMLAnchorElement>, tab: SettingsTab) => void }) {
  const premiumUntil = me?.premiumUntil ? new Date(me.premiumUntil) : null;
  const planDetail = me?.premium
    ? `Fixed-term access${premiumUntil && !isNaN(premiumUntil.getTime()) ? ` through ${premiumUntil.toLocaleDateString()}` : ""}`
    : "Free plan";
  const cards: Array<{ label: string; value: string; detail: string; tab: SettingsTab; icon: typeof SettingsIcon }> = [
    { label: "Plan", value: planLabel(me), detail: planDetail, tab: "billing", icon: CreditCard },
    { label: "Rolling allowance", value: `${me?.remaining ?? 0} left`, detail: `${me?.used ?? 0} of ${me?.limit ?? 0} resumes used in the current period`, tab: "billing", icon: Coins },
    { label: "Credits", value: String(me?.credits ?? 0), detail: "Premium generations available", tab: "credits", icon: Sparkles },
    { label: "Email", value: me?.emailVerified ? "Verified" : "Unverified", detail: me?.email || "Account email", tab: "account", icon: User },
    { label: "Notifications", value: "Manage", detail: "In-app notice and email preferences", tab: "notifications", icon: Bell },
    { label: "Application", value: "Manage", detail: "Email connection, campaigns, daily matches, and queue", tab: "application", icon: Activity },
  ];
  return (
    <>
      <div className="border-y border-[var(--border)]">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-[var(--border)] py-4">
          <h3 className="text-lg font-semibold!">Account at a glance</h3>
          {me?.email && <p className="break-all text-sm text-[var(--muted-fg)]">{me.email}</p>}
        </div>
        <ul className="grid list-none divide-y divide-[var(--border)]">
          {cards.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <a href={settingsHref(item.tab)} onClick={(event) => onSelect(event, item.tab)} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-2 py-3.5 text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)] motion-reduce:transition-none">
                  <Icon aria-hidden="true" size={18} className="mt-1 text-[var(--muted-fg)]" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="text-sm font-semibold">{item.label}</span>
                      {item.value !== "Manage" && <span className="text-sm text-[var(--muted-fg)]">{item.value}</span>}
                    </span>
                    <span className="mt-0.5 block break-words text-sm text-[var(--muted-fg)]">{item.detail}</span>
                  </span>
                  <ChevronRight aria-hidden="true" size={16} className="mt-1 text-[var(--muted-fg)]" />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      {!me?.emailVerified && (
        <div role="status">
          <Card className="border-[var(--color-warning)]/40 p-5">
            <p className="font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Verify your account email</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Email verification protects account changes and recovery. Open Account settings to update or verify your address.</p>
            <Button className="mt-4" as="a" href={settingsHref("account")} variant="outline" size="sm" onClick={(event) => onSelect(event, "account")}>Open account settings</Button>
          </Card>
        </div>
      )}
    </>
  );
}
