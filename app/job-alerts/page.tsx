"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Container, Notice, PageHeader } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import { useSession } from "@/app/session-context";
import { JOB_COUNTRIES } from "@/lib/job-config";

type JobAlert = {
  id: string;
  role_keyword: string;
  country_code: string;
  frequency: "weekly" | "daily";
  paused: boolean;
  last_sent_at: string | null;
};

const MSGS: Record<string, string> = {
  unsubscribed: "Your alert has been paused. You can re-enable it below.",
  invalid_token: "That link is invalid or the alert no longer exists.",
};

export default function JobAlertsPage() {
  const { session: me, loading: sessionLoading } = useSession();
  const [alerts, setAlerts] = useState<JobAlert[] | null>(null);
  const [busy, setBusy] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [roleKeyword, setRoleKeyword] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [frequency, setFrequency] = useState<"weekly" | "daily">("weekly");

  const isPremium = me?.premium ?? false;
  // Students ARE premium (3 slots, daily delivery) but the plan name must be
  // truthful — /api/me made the same call for plan labels.
  const isStudent = isPremium && me?.premiumSource === "student";
  const planName = isStudent ? "Student Premium" : "Premium";

  const load = useCallback(async () => {
    if (!me?.loggedIn) return;
    try {
      const r = await fetch("/api/job-alerts", { cache: "no-store" });
      if (!r.ok) throw new Error("alerts_unavailable");
      const j = await r.json();
      setAlerts(j.alerts ?? []);
      setLoadError(false);
    } catch { setLoadError(true); }
  }, [me?.loggedIn]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get("msg");
    if (msg && MSGS[msg]) setMsg({ ok: MSGS[msg] });
  }, []);

  async function create() {
    if (busy || !roleKeyword.trim()) return;
    setBusy("create");
    try {
      const r = await fetch("/api/job-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKeyword: roleKeyword.trim(), countryCode, frequency }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ error: j.error === "limit_free" ? "Free accounts get one alert. Upgrade to Premium for up to three daily alerts." : j.error === "limit_premium" ? `You already have the maximum of 3 alerts on ${planName}.` : "Could not create alert." }); return; }
      setShowForm(false);
      setRoleKeyword("");
      setMsg({ ok: `Alert created. Your first email arrives on your next ${frequency} cycle.` });
      await load();
    } catch { setMsg({ error: "Network error." }); }
    finally { setBusy(""); }
  }

  async function togglePause(alert: JobAlert) {
    setBusy(alert.id);
    try {
      await fetch("/api/job-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert.id, paused: !alert.paused }),
      });
      await load();
    } catch {} finally { setBusy(""); }
  }

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/job-alerts?id=${id}`, { method: "DELETE" });
      await load();
    } catch {} finally { setBusy(""); setPendingDelete(null); }
  }

  async function changeFreq(id: string, freq: "weekly" | "daily") {
    setBusy(id);
    try {
      await fetch("/api/job-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, frequency: freq }),
      });
      await load();
    } catch {} finally { setBusy(""); }
  }

  if (sessionLoading) {
    return (
      <main className="min-h-screen py-10"><Container>
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-[1.75rem] font-extrabold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Job Alerts</h1>
          <div className="mt-5 grid gap-3 text-left" aria-busy="true" aria-label="Loading job alerts">
          <Skeleton variant="heading" width="16rem" />
          <Skeleton variant="card" height="10rem" />
          </div>
        </div>
      </Container></main>
    );
  }

  if (me && !me.loggedIn || (!sessionLoading && !me?.loggedIn)) {
    return (
      <main className="min-h-screen py-10 md:py-16">
        <Container>
          <div className="mx-auto max-w-md text-center">
            <h1 className="text-[1.75rem] font-extrabold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Log in to manage job alerts</h1>
            <p className="mt-3 text-[var(--muted-fg)]">Get new postings for your target role delivered to your inbox.</p>
            <Button as="a" href="/login?next=/job-alerts" className="mt-6">Log in</Button>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-10 md:py-16">
      <Container size="small">
        <PageHeader
          eyebrow={isPremium ? `${planName} — daily alerts` : "Free — weekly alerts"}
          title="Job Alerts"
          description={`New postings matching your target role, sent to your inbox.${isPremium ? ` ${planName} gets daily delivery and up to three alert slots.` : " Free gets weekly delivery. Upgrade to Premium for daily alerts and more slots."}`}
        />

        {msg?.ok && <Notice variant="success" role="status" className="mb-5">{msg.ok}</Notice>}
        {msg?.error && <Notice variant="danger" role="alert" className="mb-5">{msg.error}</Notice>}

        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--border)] pt-4">
          <h2 className="text-xl font-semibold!">Your alerts</h2>
          {alerts !== null && <p className="text-sm tabular-nums text-[var(--muted-fg)]">{alerts.length} of {isPremium ? 3 : 1} slots used</p>}
        </div>
        {/* Create form */}
        {alerts !== null && alerts.length < (isPremium ? 3 : 1) && !showForm && (
          <Button onClick={() => setShowForm(true)} className="mb-6">Set up a new job alert</Button>
        )}
        {showForm && (
          <form aria-label="New job alert" onSubmit={(event) => { event.preventDefault(); void create(); }} className="mb-6 border-y border-[var(--border)] py-5">
            <h3 className="mb-4 text-lg font-semibold!">New job alert</h3>
            <label className="block mb-4">
              <span className="mb-1 block text-sm font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">What role are you looking for?</span>
              <input value={roleKeyword} onChange={(e) => setRoleKeyword(e.target.value)} placeholder="e.g. data analyst, software engineer"
                maxLength={60}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-[16px] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text)]" />
            </label>
            <label className="block mb-4">
              <span className="mb-1 block text-sm font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Country</span>
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-[16px] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text)]">
                {JOB_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            {isPremium && (
              <div className="mb-4">
                <span className="mb-1 block text-sm font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Frequency</span>
                <div className="flex gap-2">
                  {(["daily", "weekly"] as const).map((f) => (
                    <button key={f} type="button"
                      onClick={() => setFrequency(f)}
                      aria-pressed={frequency === f}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${
                        frequency === f ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--muted-fg)] dark:border-[var(--color-dark-border)]"
                      }`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" isLoading={busy === "create"} disabled={!roleKeyword.trim()}>Create alert</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {loadError && <Notice variant="danger" role="alert" className="mb-4" actions={<Button variant="outline" size="sm" onClick={() => void load()}>Try again</Button>}>Your job alerts could not load.</Notice>}
        {alerts === null && !loadError ? (
          <div className="grid gap-3" aria-busy="true">
            <Skeleton variant="card" height="8rem" />
            <Skeleton variant="card" height="8rem" />
          </div>
        ) : alerts?.length === 0 && !showForm ? (
          <div className="border-b border-[var(--border)] pb-6">
            <h3 className="font-semibold! text-[var(--fg)]">No alerts yet</h3>
            <p className="mt-1 text-sm text-[var(--muted-fg)]">Set up an alert above to get new postings in your inbox automatically.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {alerts?.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-[var(--color-border)] dark:border-[var(--color-dark-border)] p-5 bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)]">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="break-words text-base">{alert.role_keyword}</strong>
                      <Badge variant={alert.paused ? "default" : "success"}>{alert.paused ? "Paused" : alert.frequency}</Badge>
                      {!isPremium && <Badge variant="primary">Free</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-fg)]">{alert.country_code}{alert.last_sent_at ? ` — last sent ${new Date(alert.last_sent_at).toLocaleDateString()}` : " — first email pending"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPremium && (
                      <>
                        <button type="button" onClick={() => void changeFreq(alert.id, alert.frequency === "daily" ? "weekly" : "daily")}
                          disabled={busy === alert.id}
                          className="min-h-11 px-1 text-sm font-semibold text-[var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                          Switch to {alert.frequency === "daily" ? "weekly" : "daily"}
                        </button>

                      </>
                    )}
                    <button type="button" onClick={() => void togglePause(alert)} disabled={busy === alert.id}
                      className="min-h-11 px-1 text-sm font-semibold text-[var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                      {alert.paused ? "Resume" : "Pause"}
                    </button>

                    {pendingDelete === alert.id ? (
                      <button type="button" onClick={() => void remove(alert.id)} disabled={busy === alert.id}
                        className="min-h-11 px-1 text-sm font-semibold text-[var(--color-danger)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                        Confirm delete?
                      </button>
                    ) : (
                      <button type="button" onClick={() => setPendingDelete(alert.id)} disabled={busy === alert.id}
                        className="min-h-11 px-1 text-sm font-semibold text-[var(--color-danger)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Premium upsell for free users */}
        {!isPremium && (
          <Notice variant="neutral" title="Want daily alerts?" className="mt-8">
            Premium gets up to three alerts with daily delivery instead of weekly.
            <Button as="a" href="/pricing" variant="outline" size="compact" className="ml-3">See pricing</Button>
          </Notice>
        )}
      </Container>
    </main>
  );
}
