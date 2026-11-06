"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { Notice } from "@/components/ui/primitives";
import { Button } from "@/components/ui/admin/button";
import { adminFetchJson } from "../admin-helpers";
import { useAdminConfirm } from "../confirm-dialog";

type FeatureFlag = {
  name: string;
  enabled: boolean;
  rollout_percent: number;
  description: string | null;
  updated_at: string;
};

const WORKFLOW_FLAGS = new Set([
  "jobs_daily_matches",
  "role_apply_prepare",
  "role_apply_gmail_send",
  "role_apply_microsoft_send",
]);

export default function FeatureFlagView() {
  const { ask, dialog } = useAdminConfirm();
  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rollouts, setRollouts] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminFetchJson<{ flags: FeatureFlag[] }>("/api/admin/flags", { cache: "no-store" });
      if (!result.ok) throw new Error(result.error);
      setFlags(result.data?.flags || []);
    } catch {
      setMessage({ error: "Feature flags could not be loaded. No setting was changed." });
    }
  }, []);

  useAdminRefreshSignal(load);

  useEffect(() => { load(); }, [load]);

  async function applyToggle(name: string, enabled?: boolean, rolloutPercent?: number) {
    setBusy(name);
    setMessage(null);
    try {
      const result = await adminFetchJson("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled, rolloutPercent }),
      });
      if (!result.ok) throw new Error(result.error);
      await load();
      setRollouts((current) => { const next = { ...current }; delete next[name]; return next; });
      setMessage({ ok: rolloutPercent !== undefined ? `${name} rollout saved at ${rolloutPercent}%.` : `${name} is now ${enabled ? "enabled" : "disabled"}.` });
    } catch (error) {
      setMessage({ error: `Could not update ${name}: ${error instanceof Error ? error.message : "unknown error"}.` });
      throw error;
    } finally { setBusy(null); }
  }

  function toggle(name: string, current: boolean) {
    const enabled = !current;
    const workflow = WORKFLOW_FLAGS.has(name);
    const body = workflow
      ? `${enabled ? "Enable" : "Disable"} ${name}? Workflow flags apply immediately. Provider sending still requires its separate environment gate and readiness checks.`
      : `${enabled ? "Enable" : "Disable"} ${name} for all users? This change applies immediately.`;
    ask({ title: `${enabled ? "Enable" : "Disable"} ${name}`, body, word: enabled ? "ENABLE" : "DISABLE", run: () => applyToggle(name, enabled) });
  }

  return (
    <>
      <PageHeader title="Feature Flags" desc="Toggle system-wide features on or off in real time." onRefresh={load} />
      {message?.ok && <Notice variant="success" role="status">{message.ok}</Notice>}
      {message?.error && <Notice variant="danger" role="alert">{message.error}</Notice>}
      <div className="admin-workflow-link-card">
        <div><b>Job workflow controls are layered</b><p>Review environment locks, schema readiness, queue counts, attempts, outbox state, and mailbox connections before changing workflow flags.</p></div>
        <Button asChild variant="outline" size="compact"><a href="/admin/workflows">Open workflow operations</a></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2" aria-busy={flags === null}>
              {flags === null && <p role="status">Loading feature controls…</p>}
              {flags?.length === 0 && <p>No flags configured.</p>}
              {flags?.map((f) => (
                <section key={f.name} className="rounded-xl border border-admin-border bg-admin-surface/80 p-5 shadow-sm backdrop-blur-xl">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="break-all font-mono text-sm font-semibold">{f.name}</h2>
                    <Button
                      variant={f.enabled ? "success" : "outline"}
                      size="compact"
                      disabled={busy !== null}
                      isLoading={busy === f.name}
                      role="switch"
                      aria-checked={f.enabled}
                      onClick={() => toggle(f.name, f.enabled)}
                      aria-label={`${f.enabled ? "Disable" : "Enable"} ${f.name}`}
                    >
                      {f.enabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                  <p className="text-sm leading-6 text-admin-muted-fg">{f.description || "No description provided."}</p>
                  {WORKFLOW_FLAGS.has(f.name) && <p className="mt-3 text-xs text-admin-muted-fg">Provider environment gates and access approvals also apply.</p>}
                  {WORKFLOW_FLAGS.has(f.name) && <div className="mt-4">
                    <label htmlFor={`rollout-${f.name}`} className="flex justify-between text-sm"><span>User rollout</span><b>{rollouts[f.name] ?? f.rollout_percent}%</b></label>
                    <input id={`rollout-${f.name}`} className="mt-2 w-full" type="range" min={0} max={100} step={1} disabled={busy !== null} value={rollouts[f.name] ?? f.rollout_percent} onChange={(event) => setRollouts((current) => ({ ...current, [f.name]: Number(event.target.value) }))} />
                    <p className="mt-1 text-xs text-admin-muted-fg">Stable account cohorts. 0% excludes everyone; 100% includes everyone. The enable switch and all safety gates still apply.</p>
                    <Button className="mt-2" size="compact" variant="outline" disabled={busy !== null || rollouts[f.name] === undefined || rollouts[f.name] === f.rollout_percent} onClick={() => { const percent = rollouts[f.name]; ask({ title: "Apply user rollout", body: `Apply ${percent}% rollout to ${f.name}? Existing permissions and provider controls remain required.`, word: "ROLLOUT", run: () => applyToggle(f.name, undefined, percent) }); }}>Apply rollout</Button>
                  </div>}
                  <p className="mt-4 border-t border-admin-border pt-3 text-xs text-admin-muted-fg">Updated {new Date(f.updated_at).toLocaleString()}</p>
                </section>
              ))}
      </div>
      {dialog}
    </>
  );
}
