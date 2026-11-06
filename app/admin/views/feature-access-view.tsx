"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { RowActions } from "@/components/ui/admin/data-table";
import { statusToVariant } from "@/components/ui/admin/badge";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";

type Grant = {
  id: string; user_id: string; email: string; feature_key: string; state: string;
  daily_cap: number | null; provider_limit: number | null; reason: string | null;
  risk_notes: string | null; requested_at: string | null; approved_at: string | null;
  approved_by_email: string | null; expires_at: string | null; updated_at: string;
};
type GrantListResponse = { grants?: Grant[]; total?: number; page?: number; pageSize?: number; error?: string };

const labels: Record<string, string> = {
  daily_matches: "Daily Matches",
  role_apply_prepare: "Application preparation",
  role_apply_gmail: "Gmail sending",
  role_apply_microsoft: "Microsoft sending",
};

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function FeatureAccessView({ canManage, canApprove = canManage }: { canManage: boolean; canApprove?: boolean }) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("requested");
  const [approveCap, setApproveCap] = useState(5);
  const loadSequence = useRef(0);
  const [resultKey, setResultKey] = useState("");
  // Guardrail target: collect a reason before every state change (was window.prompt).
  const [pending, setPending] = useState<{ grant: Grant; state: "approved" | "suspended" | "revoked" } | null>(null);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(""); setSaved("");
    try {
      const response = await fetch(`/api/admin/feature-access?state=${encodeURIComponent(filter)}&page=${page}&pageSize=50`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({})) as GrantListResponse;
      if (!response.ok) throw new Error(data.error || "feature_access_list_failed");
      if (sequence !== loadSequence.current) return;
      const resultPage = data.page ?? page;
      setGrants(data.grants ?? []);
      setTotal(data.total ?? 0);
      setPage(resultPage);
      setPageSize(data.pageSize ?? 50);
      setResultKey(`${filter}:${resultPage}`);
    } catch {
      if (sequence === loadSequence.current) setError("Feature access records are temporarily unavailable.");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [filter, page]);
  useAdminRefreshSignal(load);
  useEffect(() => { void load(); }, [load]);

  async function change(grant: Grant, state: "approved" | "suspended" | "revoked", reason?: string) {
    if (!reason) return;
    setBusy(grant.id);
    try {
      const response = await fetch("/api/admin/feature-access", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: grant.user_id, featureKey: grant.feature_key, state, reason, dailyCap: state === "approved" ? approveCap : undefined, providerLimit: state === "approved" && (grant.feature_key.includes("gmail") || grant.feature_key.includes("microsoft")) ? approveCap : undefined }),
      });
      if (!response.ok) throw new Error("feature_access_change_failed");
      await load(); setSaved("Change saved.");
      toast.success(`${labels[grant.feature_key] ?? grant.feature_key} ${state}`);
    } catch (cause) {
      const message = "Could not confirm the feature access change. Refresh the records before retrying.";
      setError(message);
      toast.error(message);
      throw cause;
    }
    finally { setBusy(""); }
  }

  async function copyUserId(userId: string) {
    try {
      await navigator.clipboard.writeText(userId);
      toast.success("User ID copied.");
    } catch {
      toast.error("Could not copy the user ID. Select the ID text to copy it manually.");
    }
  }

  const pendingState = pending?.state;
  const currentResultKey = `${filter}:${page}`;
  const hasCurrentResults = resultKey === currentResultKey;
  const visibleGrants = hasCurrentResults ? grants : [];
  const visibleTotal = hasCurrentResults ? total : 0;

  return <>
    <PageHeader title="Workflow access" desc="Review access requests independently for Daily Matches, preparation, and each mailbox provider. Approval limits are enforced again at worker and provider boundaries." onRefresh={() => { void load(); }} />
    {filter === "requested" && hasCurrentResults && total > 0 && !error && (
      <Notice variant="warning" role="status">
        {total} access request{total === 1 ? "" : "s"} waiting for review. Approving grants access immediately; nothing sends from a user&apos;s account until its provider layers are approved too.
      </Notice>
    )}
    <div className="admin-table-card">
      <div className="admin-table-toolbar">
        <select className="admin-table-filter" aria-label="Access state" value={filter} onChange={(event) => { setPage(1); setFilter(event.target.value); }}>{["requested", "approved", "suspended", "revoked", "expired"].map((state) => <option key={state} value={state}>{state}</option>)}</select>
        {canApprove && (
          <label className="text-[var(--muted-fg)]">Approval daily cap{" "}
            <select className="admin-table-filter" aria-label="Approval daily cap" value={approveCap} onChange={(event) => setApproveCap(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((cap) => <option key={cap} value={cap}>{cap}</option>)}
            </select>
          </label>
        )}
        <span className="text-[var(--muted-fg)]">{!hasCurrentResults && loading ? "Loading records…" : `${visibleTotal} record${visibleTotal === 1 ? "" : "s"}`}</span>
      </div>
      {canManage && !canApprove && <Notice variant="info">Sign in with a named staff account to approve or restore access. This recovery session can still suspend or revoke access.</Notice>}
      {error && <Notice variant="danger" role="alert">{error}</Notice>}
      {saved && !error && <Notice variant="success" role="status">{saved}</Notice>}
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Feature</th><th>State</th><th>Requested</th><th>Limits</th><th>Review trail</th><th>Actions</th></tr></thead><tbody>
        {visibleGrants.map((grant) => <tr key={grant.id}>
          <td>
            <span className="cell-main">{grant.email}</span>
            <span className="flex items-start gap-2">
              <code className="admin-data-row-detail min-w-0 break-all font-mono select-all">{grant.user_id}</code>
              <Button type="button" variant="outline" size="compact" aria-label={`Copy user ID for ${grant.email}`} onClick={() => void copyUserId(grant.user_id)}>Copy ID</Button>
            </span>
          </td>
          <td>{labels[grant.feature_key] ?? grant.feature_key}</td>
          <td><Badge variant={statusToVariant(grant.state)}>{grant.state}</Badge></td>
          <td>{dateLabel(grant.requested_at)}</td>
          <td>{grant.daily_cap ? `Daily ${grant.daily_cap}` : "—"}{grant.provider_limit ? ` · Provider ${grant.provider_limit}` : ""}</td>
          <td>
            <span className="cell-main">{grant.approved_by_email ? `Approved by ${grant.approved_by_email}` : grant.state === "requested" ? "Awaiting first review" : "—"}</span>
            {grant.reason && <span className="admin-data-row-detail">{grant.reason}</span>}
            {grant.risk_notes && <span className="admin-data-row-detail">Risk: {grant.risk_notes}</span>}
          </td>
          <td>{canManage ? <RowActions>
            {canApprove && grant.state === "requested" && <Button size="compact" disabled={busy === grant.id} onClick={() => setPending({ grant, state: "approved" })}>Approve</Button>}
            {canApprove && (grant.state === "suspended" || grant.state === "expired") && <Button size="compact" disabled={busy === grant.id} onClick={() => setPending({ grant, state: "approved" })}>Restore</Button>}
            {grant.state === "approved" && <Button variant="outline" size="compact" disabled={busy === grant.id} onClick={() => setPending({ grant, state: "suspended" })}>Suspend</Button>}
            {grant.state !== "revoked" && <Button variant="danger" size="compact" disabled={busy === grant.id} onClick={() => setPending({ grant, state: "revoked" })}>Revoke</Button>}
          </RowActions> : <span className="text-[var(--muted-fg)]">Read only</span>}</td>
        </tr>)}
        {!visibleGrants.length && <tr><td colSpan={7} className="text-[var(--muted-fg)]">{!hasCurrentResults && loading ? "Loading access records…" : error ? "Could not load records. Use Refresh to try again." : "No records in this state."}</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--muted-fg)]">
        <span>{!hasCurrentResults && loading ? "Loading records…" : `Showing ${visibleTotal ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, visibleTotal)} of ${visibleTotal}`}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
          <span>Page {page} of {Math.max(1, Math.ceil(visibleTotal / pageSize))}</span>
          <Button variant="outline" size="sm" disabled={!hasCurrentResults || page >= Math.ceil(visibleTotal / pageSize) || loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      </div>
    </div>

    <ConfirmActionDialog
      open={!!pending}
      title={pending ? `${labels[pending.grant.feature_key] ?? pending.grant.feature_key} · ${pending.state}` : ""}
      description={pending && pending.grant.email ? `Change ${pending.grant.email}'s access state to "${pending.state}". A reason is required for the audit trail.` : undefined}
      confirmLabel={pendingState === "approved" && pending?.grant.state !== "requested" ? "Restore" : pendingState ? pendingState[0].toUpperCase() + pendingState.slice(1) : "Confirm"}
      requireReason
      minReasonLength={3}
      reasonLabel="Reason"
      reasonPlaceholder={pending?.state === "approved" ? pending.grant.state === "requested" ? "Why is this request approved?" : "Why is this access being restored?" : `Why is access being ${pending?.state ?? ""}?`}
      busy={!!busy}
      onConfirm={(reason) => (pending ? change(pending.grant, pending.state, reason) : undefined)}
      onClose={() => setPending(null)}
    />
  </>;
}
