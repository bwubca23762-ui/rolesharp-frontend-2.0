"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/app/session-context";
import { Badge, Button, Card, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import FeatureAccessPanel from "@/components/FeatureAccessPanel";
import MarketAlarm from "@/components/dashboard/MarketAlarm";

type Match = {
  id: string; campaign_id: string; canonical_job_key: string; fit_score: number; confidence_score: number;
  breakdown: { signals?: { signal: string; fitDisplayPoints: number; confidenceDisplayPoints: number; explanation: string }[] };
  blockers: { kind?: string }[]; status: string; source_url: string; expires_at: string;
  indexed_job_id: string | null; provider_namespace: string; provider_job_id: string;
  title: string | null; company: string | null; location: string | null;
};
type Campaign = { id: string; mode: string; status: string; timezone: string; daily_time: string; fit_score_floor: number; confidence_score_floor: number };
type Digest = { id: string; local_date: string; status: string; transport_status: string | null; ordered_snapshot: unknown[] };

export default function DailyMatchesClient() {
  const { session, loading: sessionLoading } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (sessionLoading) return;
    if (!session?.loggedIn) {
      setError("Log in to view your Daily Matches.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [matchResponse, campaignResponse, historyResponse] = await Promise.all([
        fetch("/api/daily-matches?limit=50", { cache: "no-store" }),
        fetch("/api/campaigns", { cache: "no-store" }),
        fetch("/api/daily-matches/history", { cache: "no-store" }),
      ]);
      if (matchResponse.status === 401) { setError("Log in to view Daily Matches."); return; }
      if (!matchResponse.ok || !campaignResponse.ok || !historyResponse.ok) throw new Error("daily_matches_unavailable");
      const matchData = (await matchResponse.json()).matches ?? [];
      setMatches(matchData);
      void Promise.all(matchData.map((match: Match) => fetch("/api/job-match-events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, eventType: "shown" }),
      }).catch(() => undefined)));
      const campaignData = await campaignResponse.json();
      setCampaign((campaignData.campaigns ?? []).find((item: Campaign) => item.mode === "daily_matches") ?? null);
      setDigests((await historyResponse.json()).digests ?? []);
      setError("");
    } catch { setError("Daily Matches are temporarily unavailable. Stored snapshots and settings were not changed."); }
    finally { setLoading(false); }
  }, [session?.loggedIn, sessionLoading]);
  useEffect(() => { void load(); }, [load]);

  async function setCampaignState(action: "pause" | "resume") {
    if (!campaign) return;
    setError("");
    setMessage("");
    const response = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    if (!response.ok) { setError(`Daily Matches could not ${action}.`); return; }
    setMessage(`Daily Matches ${action === "pause" ? "paused before the next claim" : "resumed"}.`);
    await load();
  }

  async function saveMatch(match: Match) {
    if (!match.indexed_job_id || savingMatchId !== null) return;
    setSavingMatchId(match.id);
    try {
      const response = await fetch("/api/applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: match.company || "Unknown company", role: match.title || "Job match", status: "saved",
          jobId: match.indexed_job_id, provider: match.provider_namespace,
          providerJobId: match.provider_job_id, jobUrl: match.source_url,
        }),
      });
      if (response.status === 409) setMessage("This job is already in your tracker.");
      else if (response.ok) { setMessage("Saved to your tracker."); void track(match.id, "saved"); }
      else setError("The match could not be saved. No duplicate tracker row was created.");
    } catch {
      setError("The match could not be saved. No duplicate tracker row was created.");
    } finally {
      setSavingMatchId(null);
    }
  }

  async function track(matchId: string, eventType: "opened" | "saved" | "dismissed" | "manual_applied") {
    await fetch("/api/job-match-events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, eventType }),
    }).catch(() => undefined);
  }

  return <div className="space-y-8">
    <FeatureAccessPanel />
    <PageHeader
      eyebrow="Once per local day"
      title="Daily Matches"
      description="Up to ten newly seen roles ranked by conservative fit and evidence confidence. Scores describe evidence alignment, not hiring probability."
      actions={campaign ? <Button variant="outline" onClick={() => setCampaignState(campaign.status === "active" ? "pause" : "resume")}>{campaign.status === "active" ? "Pause Daily Matches" : "Resume Daily Matches"}</Button> : undefined}
      compact
    />
    {(!sessionLoading && !session?.loggedIn) ? (
      <Notice
        title="Log in to view private match snapshots"
        variant="neutral"
        actions={<Button as="a" href="/login?next=/daily-matches" size="sm">Continue to login</Button>}
      >
        Daily Matches, digest history, and campaign state are private account data.
      </Notice>
    ) : error ? <Notice variant="danger" role="alert">{error}</Notice> : message ? <Notice variant="success" role="status">{message}</Notice> : null}
    {session?.loggedIn && !sessionLoading && <MarketAlarm />}
    {campaign ? (
      <section aria-label="Daily Matches settings summary" className="grid gap-4 border-y border-[var(--border)] py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><dt className="text-[var(--muted-fg)]">Status</dt><dd className="mt-1 font-semibold capitalize">{campaign.status}</dd></div>
          <div><dt className="text-[var(--muted-fg)]">Local time</dt><dd className="mt-1 font-semibold tabular-nums">{String(campaign.daily_time).slice(0, 5)}</dd></div>
          <div><dt className="text-[var(--muted-fg)]">Timezone</dt><dd className="mt-1 font-semibold break-words">{campaign.timezone}</dd></div>
          <div><dt className="text-[var(--muted-fg)]">Score floors</dt><dd className="mt-1 font-semibold tabular-nums">Fit {campaign.fit_score_floor} · Confidence {campaign.confidence_score_floor}</dd></div>
        </dl>
        <Button as="a" href="/campaign-settings" variant="outline" className="justify-self-start">Edit campaign settings</Button>
      </section>
    ) : (
      <EmptyState
        compact
        title="Set up Daily Matches"
        description="Create a career profile and choose your local delivery time."
        actions={<Button as="a" href="/campaign-settings">Open campaign settings</Button>}
      />
    )}

    <section aria-labelledby="ranked-heading">
      <h2 id="ranked-heading" className="text-xl font-bold!">Ranked match snapshots</h2>
      <div className="mt-4 min-h-44">
        {loading ? (
          <div className="grid gap-3" aria-busy="true">
            <Skeleton variant="card" height="9rem" />
            <Skeleton variant="card" height="9rem" />
          </div>
        ) : matches.length === 0 ? (
          <EmptyState
            compact
            title="No new qualifying matches yet"
            description="Low-confidence, expired, blocked, and previously applied jobs are excluded rather than silently promoted."
            actions={<Button as="a" href="/jobs" variant="outline">Browse all jobs</Button>}
          />
        ) : (
          <div className="grid gap-4">
            {matches.map((match) => (
              <Card key={match.id} as="article" padding="md">
                {/* DESIGN.md §5 score breakdown: fit and confidence stay two
                    separate named terms, and the badge tone is the confidence
                    variant rather than a hardcoded palette pair. */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold! break-words">{match.title || "Job match"}</h3>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{match.company || "Employer"}{match.location ? ` — ${match.location}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Badge variant="primary">Fit {match.fit_score}</Badge>
                    <Badge variant={match.confidence_score < 60 ? "warning" : "success"}>Confidence {match.confidence_score}</Badge>
                  </div>
                </div>
                {match.confidence_score < 60 && (
                  <Notice variant="warning" className="mt-3">
                    Low evidence confidence: review missing or inferred details before acting.
                  </Notice>
                )}
                <details className="mt-4">
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-2 focus-visible:outline-[var(--ring)]">Why this score?</summary>
                  <ul className="mt-3 space-y-2 text-sm">
                    {(match.breakdown?.signals ?? []).map((signal) => (
                      <li key={signal.signal} className="border-t border-[var(--border)] py-2">
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                          <span className="capitalize">{signal.signal.replaceAll("_", " ")}</span>
                          <span className="font-semibold tabular-nums">{signal.fitDisplayPoints > 0 ? "+" : ""}{signal.fitDisplayPoints} fit · {signal.confidenceDisplayPoints > 0 ? "+" : ""}{signal.confidenceDisplayPoints} confidence</span>
                        </div>
                        {signal.explanation && <p className="mt-1 text-[var(--muted-fg)]">{signal.explanation}</p>}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-[var(--color-text-muted)]">Match version: job-match-v1. Missing evidence lowers confidence and cannot inflate fit.</p>
                </details>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button as="a" href={match.source_url} target="_blank" rel="noopener noreferrer" onClick={() => void track(match.id, "opened")}>Open official job</Button>
                  {/* #jobId=, not ?job=. The builder's prefill reads "jobId"
                      only, so ?job= was silently dropped and this opened an
                      empty builder. Fragment form matches the jobs list, for
                      the reason documented at build/page.tsx:213. */}
                  {match.indexed_job_id && (
                    <Button as="a" variant="outline" href={`/build?jobId=${match.indexed_job_id}`} onClick={() => void track(match.id, "opened")}>Tailor resume</Button>
                  )}
                  <Button variant="outline" disabled={!match.indexed_job_id} isLoading={savingMatchId === match.id} onClick={() => saveMatch(match)}>Save to tracker</Button>
                  <Button variant="outline" onClick={() => { void track(match.id, "dismissed"); setMatches((current) => current.filter((item) => item.id !== match.id)); }}>Dismiss</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>

    <section aria-labelledby="history-heading">
      <h2 id="history-heading" className="text-xl font-bold!">Digest history</h2>
      <div className="mt-3 space-y-2">
        {digests.length === 0 ? (
          <EmptyState
            compact
            title="No digest snapshots yet"
            description="A snapshot is stored each day your campaign runs, so you can see exactly what was sent and when."
            actions={<Button as="a" href="/campaign-settings" variant="outline">Open campaign settings</Button>}
          />
        ) : digests.map((digest) => (
          <div key={digest.id} className="flex flex-wrap justify-between gap-2 rounded-[var(--radius)] border border-[var(--color-border)] p-4 text-sm dark:border-[var(--color-dark-border)]">
            <span><strong>{digest.local_date}</strong> — {digest.ordered_snapshot.length} matches</span>
            {/* Transport wording is claim-integrity, same rule as the queue row:
                "accepted by provider" never becomes "delivered". */}
            <span>{digest.transport_status === "provider_accepted" ? "Notification accepted by provider" : digest.transport_status === "unknown" ? "Notification outcome unknown; snapshot preserved" : digest.transport_status || digest.status}</span>
          </div>
        ))}
      </div>
    </section>
  </div>;
}
