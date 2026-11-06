"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Notice } from "@/components/ui/primitives";
import { Activity, Briefcase, Mail, Sparkles } from "../../icons";
import Skeleton from "@/components/ui/Skeleton";
import FeatureSection from "../feature-section";

export default function ApplicationSettings() {
  const [snapshot, setSnapshot] = useState<{
    connections: any[] | null;
    campaigns: any[] | null;
    matches: any[] | null;
    packages: any[] | null;
    unavailable: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [connRes, campRes, matchRes, pkgRes] = await Promise.all([
        fetch("/api/mail-connections", { cache: "no-store" }).then((r) => r.json().catch(() => null)).catch(() => null),
        fetch("/api/campaigns", { cache: "no-store" }).then((r) => r.json().catch(() => null)).catch(() => null),
        fetch("/api/daily-matches?limit=10", { cache: "no-store" }).then((r) => r.json().catch(() => null)).catch(() => null),
        fetch("/api/application-packages?limit=10", { cache: "no-store" }).then((r) => r.json().catch(() => null)).catch(() => null),
      ]);
      if (!active) return;
      const unavailable: string[] = [];
      if (!connRes?.connections) unavailable.push("email connections");
      if (!campRes?.campaigns) unavailable.push("campaigns");
      if (!matchRes?.matches) unavailable.push("daily matches");
      if (!pkgRes?.packages) unavailable.push("application queue");
      setSnapshot({
        connections: connRes?.connections ?? null,
        campaigns: campRes?.campaigns ?? null,
        matches: matchRes?.matches ?? null,
        packages: pkgRes?.packages ?? null,
        unavailable,
      });
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <FeatureSection icon={<Activity size={20} />} title="Application controls" description="How the queue drafts and schedules applications on your behalf.">
        <div className="grid gap-3" aria-busy="true">
          <Skeleton variant="card" height="6rem" />
          <Skeleton variant="card" height="6rem" />
        </div>
      </FeatureSection>
    );
  }

  const activeConnection = snapshot?.connections?.find((c: any) => c.status === "active");
  const dailyCampaign = snapshot?.campaigns?.find((c: any) => c.mode === "daily_matches" && c.status === "active");
  const applyCampaign = snapshot?.campaigns?.find((c: any) => c.mode === "role_apply" && c.status === "active");
  const reviewPackages = snapshot?.packages?.filter((p: any) => p.status === "review_required").length ?? 0;
  const eligibleMatches = snapshot?.matches?.filter((m: any) => m.status === "eligible").length ?? 0;

  const steps: Array<{
    label: string;
    status: string;
    detail: string;
    href: string;
    icon: any;
    done: boolean;
  }> = [
    {
      label: "Email connection",
      status: activeConnection ? "Connected" : "Not connected",
      detail: activeConnection
        ? `${activeConnection.provider === "google" ? "Gmail" : "Outlook"} — ${activeConnection.verified_sender}`
        : "Connect a Gmail or Outlook account for send-only application email.",
      href: "/email-connection",
      icon: Mail,
      done: !!activeConnection,
    },
    {
      label: "Daily Matches",
      status: dailyCampaign ? "Active" : "Not set up",
      detail: dailyCampaign
        ? `${eligibleMatches} eligible match${eligibleMatches === 1 ? "" : "es"} — ${dailyCampaign.daily_limit} per day`
        : "Set your roles, locations, and delivery time to receive match digests.",
      href: dailyCampaign ? "/daily-matches" : "/campaign-settings",
      icon: Sparkles,
      done: !!dailyCampaign,
    },
    {
      label: "Auto-apply campaign",
      status: applyCampaign ? "Active" : "Not set up",
      detail: applyCampaign
        ? `Campaign ${applyCampaign.status} — ${applyCampaign.daily_limit} per day limit`
        : "Configure review-first or campaign-policy application email.",
      href: "/campaign-settings",
      icon: Activity,
      done: !!applyCampaign,
    },
    {
      label: "Application queue",
      status: reviewPackages > 0 ? `${reviewPackages} to review` : "No pending reviews",
      detail: reviewPackages > 0
        ? "Review immutable application packages before they are sent."
        : "Approved packages appear here with delivery status.",
      href: "/application-queue",
      icon: Briefcase,
      done: true,
    },
  ];

  return (
    <FeatureSection icon={<Activity size={20} />} title="Application controls" description="How the queue drafts and schedules applications on your behalf.">
      <Notice variant="neutral" className="mb-5">
        Manage your email connection, campaign settings, daily matches, and application queue from this central location. Each section links to its full configuration page.
      </Notice>
      {snapshot?.unavailable && snapshot.unavailable.length > 0 && (
        <p className="mb-4 text-sm text-[var(--color-warning)]">
          Some data is temporarily unavailable: {snapshot.unavailable.join(", ")}.
        </p>
      )}
      <div className="grid gap-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.label} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{step.label}</strong>
                      <Badge variant={step.done ? "success" : "outline"}>{step.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{step.detail}</p>
                  </div>
                </div>
                <Button as="a" href={step.href} variant="outline" size="sm">
                  {step.done ? "Manage" : "Set up"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button as="a" href="/auto-apply" variant="outline" size="sm">Auto Apply overview</Button>
        <Button as="a" href="/tracker" variant="outline" size="sm">Application tracker</Button>
        <Button as="a" href="/daily-matches" variant="outline" size="sm">Daily Matches</Button>
      </div>
    </FeatureSection>
  );
}
