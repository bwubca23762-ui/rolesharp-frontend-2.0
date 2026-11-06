"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/app/session-context";
import { Button, Notice } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";

const labels: Record<string, string> = {
  daily_matches: "Daily Matches",
  role_apply_prepare: "Application preparation",
  role_apply_gmail: "Gmail sending",
  role_apply_microsoft: "Microsoft sending",
};

type Grant = {
  featureKey: string;
  state: string;
  active: boolean;
  dailyCap: number | null;
  providerLimit: number | null;
  expiresAt: string | null;
};

export default function FeatureAccessPanel() {
  const { session, loading: sessionLoading } = useSession();
  const loggedOut = !sessionLoading && !session?.loggedIn;
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (sessionLoading) return;
    if (!session?.loggedIn) {
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/feature-access", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as { grants?: Grant[]; error?: string };
      if (!response.ok) throw new Error(data.error || "feature_access_unavailable");
      setGrants(data.grants ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "login_required" ? "Log in to request workflow access." : "Access status is temporarily unavailable.");
    } finally { setLoading(false); }
  }, [session?.loggedIn, sessionLoading]);

  useEffect(() => { void load(); }, [load]);

  async function request(featureKey: string) {
    setBusy(featureKey); setError(""); setMessage("");
    try {
      const response = await fetch("/api/feature-access", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featureKey }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "feature_access_request_failed");
      setMessage(`${labels[featureKey] ?? featureKey} access requested. Your tile below now shows "requested" — an admin reviews new requests, usually within a day, and nothing is sent from your account until it is approved.`);
      await load();
    } catch { setError("The access request could not be submitted. No workflow state was changed."); }
    finally { setBusy(""); }
  }

  if (sessionLoading || loading) return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
      <Skeleton variant="card" height="9rem" />
      <Skeleton variant="card" height="9rem" />
    </div>
  );
  if (loggedOut) return <section aria-labelledby="feature-access-heading" className="space-y-4">
    <div>
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">Admin approval required</p>
      <h2 id="feature-access-heading" className="mt-2 text-2xl font-bold">Workflow access</h2>
    </div>
    <Notice title="Sign in to request workflow access" variant="neutral" actions={<Button as="a" href="/login?next=/auto-apply" size="sm">Log in securely</Button>}>
      Daily Matches, application preparation, and each sending provider are approved separately.
    </Notice>
  </section>;
  return <section aria-labelledby="feature-access-heading" className="space-y-4">
    <div>
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">Admin approval required</p>
      <h2 id="feature-access-heading" className="mt-2 text-2xl font-bold">Workflow access</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-muted)]">Daily Matches, application preparation, and each sending provider are approved separately. Revocation stops future queued work at the server boundary.</p>
    </div>
    {error && <Notice variant="danger" role="alert">{error}</Notice>}
    {message && <Notice variant="success" role="status">{message}</Notice>}
    <div className="grid gap-3 md:grid-cols-2">
      {grants.map((grant) => <article key={grant.featureKey} className="rounded-2xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]">
        <div className="flex items-start justify-between gap-3"><h3 className="font-bold">{labels[grant.featureKey] ?? grant.featureKey}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${grant.active ? "bg-emerald-100 text-emerald-800" : grant.state === "requested" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{grant.state}</span></div>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{grant.active ? `Active${grant.expiresAt ? ` until ${new Date(grant.expiresAt).toLocaleDateString()}` : ""}.` : grant.state === "requested" ? "Requested — waiting for an admin review, usually within a day. You'll see this tile flip to active here; no email is sent." : "Not active. Requesting access queues it for an admin review — nothing sends from your account until it is approved."}</p>
        {grant.active && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{grant.dailyCap ? `Daily cap: ${grant.dailyCap}. ` : ""}{grant.providerLimit ? `Provider cap: ${grant.providerLimit}.` : ""}</p>}
        {!grant.active && grant.state !== "requested" && <Button className="mt-4" size="sm" variant="outline" disabled={busy === grant.featureKey} isLoading={busy === grant.featureKey} onClick={() => void request(grant.featureKey)}>{busy === grant.featureKey ? "Requesting…" : "Request access"}</Button>}
      </article>)}
    </div>
  </section>;
}
