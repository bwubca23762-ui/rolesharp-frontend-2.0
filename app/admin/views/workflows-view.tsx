"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  ChevronRight,
  FileText,
  LifeBuoy,
  Lock,
  Server,
  Shield,
} from "@/app/icons";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { useAdminConfirm } from "../confirm-dialog";
import Skeleton from "@/components/ui/Skeleton";
import { adminFetchJson } from "../admin-helpers";

type StatusRow = { status: string; count: number; oldest_at: string | null };
type ConnectionRow = StatusRow & { provider: string };
type Resource<T> = { available: boolean; rows: T[] };
type Control = { explicitlyConfigured: boolean; enabled: boolean };

type WorkflowHealth = {
  operationalState: "unavailable" | "disabled" | "attention" | "ready";
  safetyLock: {
    workflowsDisabled: boolean;
    gmailSendingDisabled: boolean;
    microsoftSendingDisabled: boolean;
  };
  readiness: null | {
    namespace: string;
    tokenEncryption: boolean;
    workflowsEnabled: boolean;
    gmail: boolean;
    microsoft: boolean;
    callbackOrigins: boolean;
  };
  controls: {
    workflows: Control;
    gmailSend: Control;
    microsoftSend: Control;
  };
  flags: {
    jobs_daily_matches: boolean;
    role_apply_prepare: boolean;
    role_apply_gmail_send: boolean;
    role_apply_microsoft_send: boolean;
  };
  database: {
    schemaReady: boolean;
    resources: {
      workItems: Resource<StatusRow>;
      attempts: Resource<StatusRow>;
      outbox: Resource<StatusRow>;
      connections: Resource<ConnectionRow>;
    };
  };
  warnings: Array<{ code: string; message: string; level: "warning" | "danger" }>;
  generatedAt: string;
};

const LABELS: Record<string, string> = {
  pending: "Pending",
  claimed: "Claimed",
  completed: "Completed",
  canceled: "Canceled",
  retryable: "Retryable",
  unknown: "Unknown",
  terminal_failed: "Terminal failed",
  queued: "Queued",
  reserved: "Reserved",
  sending: "Sending",
  provider_accepted: "Provider accepted",
  needs_user: "Needs user",
  failed: "Failed",
  active: "Active",
  disabled: "Disabled",
  blocked: "Blocked",
};

function statusLabel(value: string) {
  return LABELS[value] ?? value.replaceAll("_", " ");
}

function total<T extends { count: number }>(resource: Resource<T>) {
  return resource.rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
}

function oldestLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "under a minute ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// This returned `badge-bad` for the failure states, and `.badge-bad` is defined
// in no stylesheet in this repo — so on the one dashboard whose job is to show
// what is broken, a failed or unknown workflow rendered in the same neutral grey
// as an idle one. `Badge` variants are props, so a name that does not exist is a
// type error instead of silence.
function rowTone(status: string): ComponentProps<typeof Badge>["variant"] {
  if (["unknown", "terminal_failed", "failed"].includes(status)) return "danger";
  if (["needs_user", "retryable", "blocked", "sending", "claimed", "reserved"].includes(status)) return "warning";
  if (["completed", "provider_accepted", "active"].includes(status)) return "success";
  return "default";
}

export default function WorkflowsView({ canToggleFlags = false, canManageQueue = false }: { canToggleFlags?: boolean; canManageQueue?: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [data, setData] = useState<WorkflowHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flagBusy, setFlagBusy] = useState("");
  const [flagMessage, setFlagMessage] = useState<{ ok?: string; error?: string } | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueMessage, setQueueMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminFetchJson<WorkflowHealth>("/api/admin/jobs-workflows/health", { cache: "no-store" });
      if (!result.ok || !result.data) throw new Error("workflow_health_unavailable");
      setData(result.data);
    } catch {
      setError("Workflow health could not be loaded. No flags or queue state were changed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useAdminRefreshSignal(load);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  async function repairQueue(action: "recoverStuckSends" | "retryFailed") {
    setQueueBusy(true); setQueueMessage(null);
    const result = await adminFetchJson<Record<string, number>>("/api/admin/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setQueueMessage({ ok: result.ok, text: result.ok ? `Operation completed: ${JSON.stringify(result.data)}` : result.error });
    setQueueBusy(false);
    if (result.ok) await load();
  }

  // Direct flag control from the workflows dashboard: the same /api/admin/flags
  // endpoint the Feature Flags view uses, so the audit trail and permission gate
  // (flags.manage) are identical. The global JOBS_WORKFLOWS_ENABLED environment
  // gate still wins — a flag flipped here only arms its layer.
  async function applyToggle(name: keyof WorkflowHealth["flags"], enabled: boolean) {
    setFlagBusy(name);
    setFlagMessage(null);
    try {
      const result = await adminFetchJson("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled }),
      });
      if (!result.ok) throw new Error(result.error || "flag_update_failed");
      setFlagMessage({ ok: `${name} is now ${enabled ? "enabled" : "disabled"}.` });
      await load();
    } catch (err) {
      setFlagMessage({ error: `Could not update ${name}: ${err instanceof Error ? err.message : "unknown error"}. No flag was changed.` });
    } finally {
      setFlagBusy("");
    }
  }

  function toggleFlag(name: keyof WorkflowHealth["flags"], current: boolean) {
    const enabled = !current;
    const body = `${enabled ? "Enable" : "Disable"} ${name}? The change applies immediately. ` +
      (name === "jobs_daily_matches"
        ? "Daily Matches still requires the global environment gate and migrated schema before anything runs."
        : "Provider sending still requires its separate environment gate and readiness checks.");
    ask({ title: `${enabled ? "Enable" : "Disable"} ${name}`, body, word: enabled ? "ENABLE" : "DISABLE", run: () => applyToggle(name, enabled) });
  }

  const gates = useMemo(() => {
    if (!data) return [];
    const global = data.controls.workflows.enabled && Boolean(data.readiness?.workflowsEnabled);
    const schema = data.database.schemaReady;
    return [
      {
        label: "Workflow engine",
        active: global && schema,
        status: !data.controls.workflows.explicitlyConfigured ? "Not explicit" : global ? (schema ? "Enabled" : "Schema blocked") : "Locked",
        detail: global ? "Global process gate is open." : "JOBS_WORKFLOWS_ENABLED keeps every workflow off.",
        flag: null as keyof WorkflowHealth["flags"] | null,
      },
      {
        label: "Daily Matches",
        active: global && schema && data.flags.jobs_daily_matches,
        status: data.flags.jobs_daily_matches ? (global && schema ? "Enabled" : "Layer armed") : "Disabled",
        detail: "Requires the global gate, migrated schema, and jobs_daily_matches flag.",
        flag: "jobs_daily_matches" as keyof WorkflowHealth["flags"] | null,
      },
      {
        label: "Package preparation",
        active: global && schema && data.flags.role_apply_prepare,
        status: data.flags.role_apply_prepare ? (global && schema ? "Enabled" : "Layer armed") : "Disabled",
        detail: "Prepares immutable review packages; it does not send email by itself.",
        flag: "role_apply_prepare" as keyof WorkflowHealth["flags"] | null,
      },
      {
        label: "Gmail sending",
        active: global && schema && data.controls.gmailSend.enabled && data.flags.role_apply_gmail_send && Boolean(data.readiness?.gmail && data.readiness?.tokenEncryption),
        status: data.safetyLock.gmailSendingDisabled ? "Locked" : data.flags.role_apply_gmail_send ? "Review readiness" : "Flag disabled",
        detail: "Requires credentials, token encryption, the environment switch, and the database flag.",
        flag: "role_apply_gmail_send" as keyof WorkflowHealth["flags"] | null,
      },
      {
        label: "Microsoft sending",
        active: global && schema && data.controls.microsoftSend.enabled && data.flags.role_apply_microsoft_send && Boolean(data.readiness?.microsoft && data.readiness?.tokenEncryption),
        status: data.safetyLock.microsoftSendingDisabled ? "Locked" : data.flags.role_apply_microsoft_send ? "Review readiness" : "Flag disabled",
        detail: "Requires credentials, token encryption, the environment switch, and the database flag.",
        flag: "role_apply_microsoft_send" as keyof WorkflowHealth["flags"] | null,
      },
    ];
  }, [data]);

  const stateCopy = data?.operationalState === "disabled"
    ? { title: "Automation is deliberately disabled", detail: "Queue and connection counts remain visible while the global execution gate stays closed.", issue: false }
    : data?.operationalState === "ready"
      ? { title: "Workflow infrastructure is ready", detail: "Configured gates and redacted operational signals are available.", issue: false }
      : data?.operationalState === "attention"
        ? { title: "Workflow operations need attention", detail: "Review the warnings and non-terminal queue states below.", issue: true }
        : { title: "Workflow infrastructure is unavailable", detail: "Configuration or database migrations must be reviewed before any enablement.", issue: true };

  return (
    <>
      <PageHeader

        title="Workflow operations"
        desc="Redacted readiness, layered kill switches, durable work, application attempts, notifications, and mailbox connection health."
        onRefresh={load}
      />
      {canManageQueue && <div className="admin-chart-card mb-5"><h2 className="mb-2 text-base font-semibold">Queue recovery</h2><p className="mb-3 text-sm">Abandoned mail sends are marked unknown rather than resent. Failed resume jobs can be retried separately.</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="compact" disabled={queueBusy} onClick={() => ask({ title: "Resolve abandoned sends", body: "Sends abandoned for over an hour are marked unknown. This does not resend mail.", word: "RECOVER", run: () => repairQueue("recoverStuckSends") })}>Resolve abandoned sends</Button><Button variant="outline" size="compact" disabled={queueBusy} onClick={() => ask({ title: "Retry failed resume jobs", body: "Up to 200 failed resume-generation jobs are retried, subject to their attempt caps.", word: "RETRY", run: () => repairQueue("retryFailed") })}>Retry failed resume jobs</Button></div>{queueMessage && <Notice className="mt-3" variant={queueMessage.ok ? "success" : "danger"} role={queueMessage.ok ? "status" : "alert"}>{queueMessage.text}</Notice>}</div>}

      {loading && !data && (
        <div className="admin-table-card" aria-busy="true">
          <Skeleton variant="heading" width="12rem" />
          <div className="grid gap-2" style={{ marginTop: 12 }}>
            {[0, 1, 2, 3, 4, 5].map((row) => <Skeleton key={row} variant="table-row" />)}
          </div>
        </div>
      )}
      {error && (
        <Notice variant="danger" role="alert">
          {error} <Button variant="outline" size="compact" onClick={() => void load()}>Retry</Button>
        </Notice>
      )}

      {data && (
        <>
          <div className={`admin-ops-banner ${stateCopy.issue ? "has-issues" : "is-healthy"}`}>
            <span className="admin-ops-signal" />
            <div><b>{stateCopy.title}</b><p>{stateCopy.detail}</p></div>
            <Link href="/admin/flags">Open feature flags <ChevronRight size={15} /></Link>
          </div>

          <section className="admin-workflow-safety" aria-labelledby="workflow-safety-heading">
            <span><Lock size={19} /></span>
            <div>
              <h2 id="workflow-safety-heading">Sending safety lock</h2>
              <p>
                Gmail is <b>{data.safetyLock.gmailSendingDisabled ? "locked" : "not locked"}</b>; Microsoft is <b>{data.safetyLock.microsoftSendingDisabled ? "locked" : "not locked"}</b>.
                Unknown provider outcomes are review-only and must never be automatically resent.
              </p>
            </div>
            <Link href="/admin/actions">Audit log <ChevronRight size={14} /></Link>
          </section>

          {flagMessage?.ok && <Notice variant="success" role="status">{flagMessage.ok}</Notice>}
          {flagMessage?.error && <Notice variant="danger" role="alert">{flagMessage.error}</Notice>}

          <section aria-labelledby="workflow-gates-heading">
            <div className="admin-section-heading">
              <div><span>Layered controls</span><h2 id="workflow-gates-heading">Execution gates</h2></div>
              <small>Environment + database + readiness</small>
            </div>
            <div className="admin-workflow-gates">
              {gates.map((gate) => {
                const flag = gate.flag;
                return (
                  <article className="admin-workflow-gate" key={gate.label}>
                    <span className={gate.active ? "is-active" : "is-locked"}>{gate.active ? <Activity size={17} /> : <Lock size={17} />}</span>
                    <div><h3>{gate.label}</h3><p>{gate.detail}</p></div>
                    <Badge variant={gate.active ? "success" : "default"}>{gate.status}</Badge>
                    {flag && data && (canToggleFlags ? (
                      <Button
                        variant={data.flags[flag] ? "primary" : "outline"}
                        size="compact"
                        disabled={flagBusy === flag}
                        isLoading={flagBusy === flag}
                        onClick={() => void toggleFlag(flag, data.flags[flag])}
                        aria-label={`${data.flags[flag] ? "Disable" : "Enable"} ${flag}`}
                      >
                        {data.flags[flag] ? "Disable" : "Enable"}
                      </Button>
                    ) : (
                      <span className="text-[var(--muted-fg)]">Flag read only</span>
                    ))}
                  </article>
                );
              })}
            </div>
          </section>

          {data.warnings.length > 0 && (
            <section className="admin-priority-panel admin-workflow-warnings" aria-labelledby="workflow-warning-heading">
              <div className="admin-section-heading"><div><span>Operator review</span><h2 id="workflow-warning-heading">Warnings</h2></div><small>{data.warnings.length} signal{data.warnings.length === 1 ? "" : "s"}</small></div>
              <div className="admin-priority-list">
                {data.warnings.map((warning) => (
                  <div className={warning.level} key={warning.code}><AlertTriangle size={16} /><b>{warning.message}</b></div>
                ))}
              </div>
            </section>
          )}

          <div className="admin-workflow-metrics" aria-label="Workflow totals">
            <WorkflowMetric icon={<Briefcase size={19} />} label="Durable work" resource={data.database.resources.workItems} />
            <WorkflowMetric icon={<FileText size={19} />} label="Application attempts" resource={data.database.resources.attempts} />
            <WorkflowMetric icon={<LifeBuoy size={19} />} label="Notification outbox" resource={data.database.resources.outbox} />
            <WorkflowMetric icon={<Shield size={19} />} label="Mailbox connections" resource={data.database.resources.connections} />
          </div>

          <div className="admin-workflow-tables">
            <StatusTable title="Durable work items" icon={<Server size={17} />} resource={data.database.resources.workItems} />
            <StatusTable title="Application mail attempts" icon={<FileText size={17} />} resource={data.database.resources.attempts} />
            <StatusTable title="Notification outbox" icon={<LifeBuoy size={17} />} resource={data.database.resources.outbox} />
            <ConnectionTable resource={data.database.resources.connections} />
          </div>

          <p className="admin-workflow-timestamp">
            Last checked {new Date(data.generatedAt).toLocaleString()} · namespace {data.readiness?.namespace ?? "unavailable"} · no tokens, recipients, resumes, subjects, or message bodies are returned.
          </p>
        </>
      )}
      {dialog}
    </>
  );
}

function WorkflowMetric<T extends { count: number }>({ icon, label, resource }: { icon: React.ReactNode; label: string; resource: Resource<T> }) {
  return (
    <article>
      <span>{icon}</span>
      <div><small>{label}</small><strong>{resource.available ? total(resource).toLocaleString() : "—"}</strong><p>{resource.available ? "Grouped status rows available" : "Schema unavailable"}</p></div>
    </article>
  );
}

function StatusTable({ title, icon, resource }: { title: string; icon: React.ReactNode; resource: Resource<StatusRow> }) {
  return (
    <section className="admin-table-card">
      <div className="admin-workflow-table-heading">{icon}<div><h2>{title}</h2><p>{resource.available ? `${total(resource)} total` : "Table unavailable"}</p></div></div>
      {resource.available ? (
        <div className="admin-table-wrap" tabIndex={0} aria-label={`${title} status table`}><table className="admin-table"><thead><tr><th>Status</th><th className="num-col">Count</th><th>Oldest record</th></tr></thead><tbody>
          {resource.rows.length === 0 && <tr><td colSpan={3} className="text-[var(--muted-fg)]">No records.</td></tr>}
          {resource.rows.map((row) => <tr key={row.status}><td><Badge variant={rowTone(row.status)}>{statusLabel(row.status)}</Badge></td><td className="num-col">{row.count}</td><td>{oldestLabel(row.oldest_at)}</td></tr>)}
        </tbody></table></div>
      ) : <p className="admin-workflow-unavailable">This table is unavailable. Verify the pending workflow migrations before enabling any gate.</p>}
    </section>
  );
}

function ConnectionTable({ resource }: { resource: Resource<ConnectionRow> }) {
  return (
    <section className="admin-table-card">
      <div className="admin-workflow-table-heading"><Shield size={17} /><div><h2>Mailbox connections</h2><p>{resource.available ? `${total(resource)} total` : "Table unavailable"}</p></div></div>
      {resource.available ? (
        <div className="admin-table-wrap" tabIndex={0} aria-label="Mailbox connection status table"><table className="admin-table"><thead><tr><th>Provider</th><th>Status</th><th className="num-col">Count</th><th>Oldest record</th></tr></thead><tbody>
          {resource.rows.length === 0 && <tr><td colSpan={4} className="text-[var(--muted-fg)]">No mailbox connections.</td></tr>}
          {resource.rows.map((row) => <tr key={`${row.provider}-${row.status}`}><td className="cell-main">{row.provider === "google" ? "Google" : row.provider === "microsoft" ? "Microsoft" : row.provider}</td><td><Badge variant={rowTone(row.status)}>{statusLabel(row.status)}</Badge></td><td className="num-col">{row.count}</td><td>{oldestLabel(row.oldest_at)}</td></tr>)}
        </tbody></table></div>
      ) : <p className="admin-workflow-unavailable">Mailbox connection storage is unavailable. Provider sending remains blocked.</p>}
    </section>
  );
}
