"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/admin/button";
import { RowActions } from "@/components/ui/admin/data-table";
import { statusToVariant } from "@/components/ui/admin/badge";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";
import { adminFetchJson } from "../admin-helpers";

type StaffAccount = {
  id: string;
  email: string;
  display_name: string | null;
  status: "invited" | "active" | "suspended" | "revoked";
  last_login_at: string | null;
  created_at: string;
  roles: string[];
  active_sessions: number;
};

type StaffRole = {
  role_key: string;
  label: string;
  description: string;
  owner_only: boolean;
  permissions: string[];
};

type StaffResponse = { staff: StaffAccount[]; roles: StaffRole[] };

type StaffAction =
  | { action: "assign_role" | "revoke_role"; staffAccountId: string; role: string; reason?: string }
  | { action: "suspend" | "revoke" | "reactivate" | "revoke_sessions"; staffAccountId: string; reason?: string };

function readableError(code: string): string {
  const messages: Record<string, string> = {
    forbidden: "This account cannot manage staff access.",
    invalid_staff_domain: "The email is outside the configured staff domain.",
    staff_invite_conflict: "That staff account already exists and cannot be reinvited.",
    owner_self_lockout_denied: "The current owner account cannot suspend or revoke itself.",
    owner_last_active_lockout_denied: "At least one other active owner is required before this owner can be disabled.",
    invalid_staff_state: "That account cannot make this status transition.",
    staff_role_not_found: "That role is not currently assigned.",
    owner_staff_session_required:
      "Staff changes need a named staff Google sign-in. Break-glass recovery sessions are read-only here.",
  };
  return messages[code] ?? "The staff access operation failed.";
}

export default function StaffView({
  canManage,
  breakGlass = false,
  currentStaffAccountId = null,
}: {
  canManage: boolean;
  breakGlass?: boolean;
  currentStaffAccountId?: string | null;
}) {
  const [data, setData] = useState<StaffResponse | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  // Guardrail target: a destructive action waits for type-to-confirm (or, for
  // the audit-trail actions, an AlertDialog with a reason). Null means no dialog.
  const [pending, setPending] = useState<{ account: StaffAccount; action: StaffAction["action"]; role?: string } | null>(null);

  const assignableRoles = useMemo(
    () => (data?.roles ?? []).filter((role) => !role.owner_only),
    [data],
  );

  const load = useCallback(async () => {
    setError(""); setSaved("");
    try {
      const result = await adminFetchJson<StaffResponse>("/api/admin/staff", { cache: "no-store" });
      if (!result.ok || !result.data) throw new Error(result.error || "staff_list_failed");
      const payload = result.data;
      setData(payload);
      if (!payload.roles.some((role) => role.role_key === inviteRole && !role.owner_only)) {
        setInviteRole(payload.roles.find((role) => !role.owner_only)?.role_key ?? "admin");
      }
    } catch (cause) {
      setError(readableError(cause instanceof Error ? cause.message : "staff_list_failed"));
    }
  }, [inviteRole]);

  useAdminRefreshSignal(load);

  useEffect(() => { void load(); }, [load]);

  async function mutate(payload: StaffAction | { action: "invite"; email: string; displayName?: string; role: string }, key: string): Promise<boolean> {
    setBusy(key);
    setError(""); setSaved("");
    try {
      const result = await adminFetchJson("/api/admin/staff", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!result.ok) throw new Error(result.error || "staff_management_failed");
      await load(); setSaved("Change saved.");
      toast.success("Staff change saved.");
      return true;
    } catch (cause) {
      const message = readableError(cause instanceof Error ? cause.message : "staff_management_failed");
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBusy("");
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const succeeded = await mutate({ action: "invite", email: email.trim(), displayName: displayName.trim() || undefined, role: inviteRole }, "invite");
    if (succeeded) {
      setEmail("");
      setDisplayName("");
      toast.success(`Staff access prepared for ${email.trim()}. They can sign in with their approved Google account.`);
    }
  }

  function beginAction(account: StaffAccount, action: StaffAction["action"], role?: string) {
    const destructive = action === "suspend" || action === "revoke" || action === "revoke_sessions" || action === "revoke_role";
    if (destructive) {
      // Destructive actions confirm first; revoke/revoke_sessions collect a
      // reason for the audit trail. This replaces the old window.confirm/prompt.
      setPending({ account, action, role });
      return;
    }
    if (action === "assign_role") {
      void mutate({ action: "assign_role", staffAccountId: account.id, role: role || "" } satisfies StaffAction, `${account.id}:assign_role:${role ?? ""}`);
      return;
    }
    void mutate({ action, staffAccountId: account.id } satisfies StaffAction, `${account.id}:${action}`);
  }

  async function runConfirmedAction(reason?: string) {
    if (!pending) return;
    const { account, action, role } = pending;
    const payload: StaffAction = action === "assign_role" || action === "revoke_role"
      ? { action, staffAccountId: account.id, role: role || "", reason }
      : { action, staffAccountId: account.id, reason };
    // Return the promise so ConfirmDialog stays open with busy feedback until
    // the mutation settles (void-ing it closed the dialog in 0ms).
    if (!await mutate(payload, `${account.id}:${action}:${role ?? ""}`)) throw new Error("Staff change failed.");
  }

  // Break-glass recovery sessions carry every permission but no staff identity,
  // and the API refuses unattributed staff mutations (owner_staff_session_required).
  const readOnlyRecovery = breakGlass;
  const effectiveCanManage = canManage && !readOnlyRecovery;
  // QA hitlist #3: the current operator can never suspend/revoke their own row.
  const isSelf = (account: StaffAccount) => currentStaffAccountId != null && account.id === currentStaffAccountId;

  return (
    <>
      <PageHeader

        title="Staff access"
        desc="Invite exact staff identities, assign scoped roles, and revoke active access. Owner roles are bootstrap-managed and cannot be delegated here."
        onRefresh={() => { void load(); }}
      />

      {readOnlyRecovery && (
        <div className="admin-chart-card" role="status" style={{ marginBottom: 18, borderColor: "var(--warning, #d97706)" }}>
          You are signed in with <b>break-glass recovery access</b>. Staff invites, role changes, and revocations
          require signing in with your named staff Google account so every change is attributed. This workspace is
          read-only for the rest of this session.
        </div>
      )}

      {error && <div className="admin-chart-card" role="alert" style={{ marginBottom: 18, borderColor: "var(--danger)" }}>{error}</div>}
      {saved && !error && <div className="admin-chart-card" role="status" style={{ marginBottom: 18, borderColor: "var(--success)" }}>{saved}</div>}

      <details className="admin-chart-card mb-5">
        <summary className="cursor-pointer font-semibold">Role permission matrix</summary>
        <p className="my-3 text-sm">Permissions come from the active server role definitions. Assign or remove roles using each staff account’s controls below.</p>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Permission</th>{data?.roles.map((role) => <th scope="col" key={role.role_key}>{role.label}</th>)}</tr></thead><tbody>
          {["users.manage", "support.manage", "communications.read", "mail.manage", "content.publish", "jobs.manage", "system.manage"].map((permission) => <tr key={permission}><th scope="row" className="font-mono text-xs">{permission}</th>{data?.roles.map((role) => <td key={role.role_key}><span aria-label={role.permissions?.includes(permission) ? "Granted" : "Not granted"}>{role.permissions?.includes(permission) ? "✓" : "—"}</span></td>)}</tr>)}
        </tbody></table></div>
      </details>

      {effectiveCanManage && (
        <form className="admin-chart-card" onSubmit={invite} style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Invite staff</h2>
          <div className="admin-table-toolbar" style={{ padding: 0, border: 0 }}>
            <input className="admin-table-search" type="email" required maxLength={254} placeholder="staff@example.com" aria-label="Staff email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className="admin-table-search" maxLength={160} placeholder="Display name (optional)" aria-label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <select className="admin-table-filter" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} aria-label="Initial staff role">
              {assignableRoles.map((role) => <option key={role.role_key} value={role.role_key}>{role.label}</option>)}
            </select>
            <Button type="submit" isLoading={busy === "invite"}>{busy === "invite" ? "Inviting…" : "Invite"}</Button>
          </div>
        </form>
      )}

      <div className="admin-table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Staff identity</th><th>Status</th><th>Roles</th><th>Sessions</th><th>Last login</th><th>Controls</th></tr></thead>
            <tbody>
              {(data?.staff ?? []).map((account) => (
                <tr key={account.id}>
                  <td>
                    <span className="cell-main">{account.display_name || account.email}</span>
                    {account.display_name && <span className="admin-data-row-detail">{account.email}</span>}
                  </td>
                  <td><Badge variant={statusToVariant(account.status)}>{account.status}</Badge></td>
                  <td>{account.roles.length ? account.roles.join(", ") : <span className="text-[var(--muted-fg)]">No role</span>}</td>
                  <td className="num-col">{account.active_sessions}</td>
                  <td>{account.last_login_at ? new Date(account.last_login_at).toLocaleString() : <span className="text-[var(--muted-fg)]">Never</span>}</td>
                  <td>
                    {effectiveCanManage ? (
                      <RowActions>
                        <select className="admin-table-filter" aria-label={`Role action for ${account.email}`} defaultValue="" onChange={(event) => {
                          const [action, role] = event.target.value.split(":");
                          if (action && role) beginAction(account, action as "assign_role" | "revoke_role", role);
                          event.target.value = "";
                        }}>
                          <option value="">Role action</option>
                          {assignableRoles.map((role) => account.roles.includes(role.role_key)
                            ? <option key={`revoke:${role.role_key}`} value={`revoke_role:${role.role_key}`}>Remove {role.label}</option>
                            : <option key={`assign:${role.role_key}`} value={`assign_role:${role.role_key}`}>Add {role.label}</option>)}
                        </select>
                        {account.active_sessions > 0 && <Button variant="outline" size="sm" type="button" disabled={busy.startsWith(account.id)} onClick={() => beginAction(account, "revoke_sessions")}>Revoke sessions</Button>}
                        {account.status === "active" && !isSelf(account) && <Button variant="outline" size="sm" type="button" disabled={busy.startsWith(account.id)} onClick={() => beginAction(account, "suspend")}>Suspend</Button>}
                        {account.status === "suspended" && !isSelf(account) && <Button variant="outline" size="sm" type="button" disabled={busy.startsWith(account.id)} onClick={() => beginAction(account, "reactivate")}>Reactivate</Button>}
                        {account.status !== "revoked" && !isSelf(account) && <Button variant="destructive" size="sm" type="button" disabled={busy.startsWith(account.id)} onClick={() => beginAction(account, "revoke")}>Revoke</Button>}
                        {isSelf(account) && <span className="text-[var(--muted-fg)]" title="You cannot suspend or revoke your own account.">—</span>}
                      </RowActions>
                    ) : <span className="text-[var(--muted-fg)]">{readOnlyRecovery ? "Read only (recovery session)" : "Read only"}</span>}
                  </td>
                </tr>
              ))}
              {data && data.staff.length === 0 && <tr><td colSpan={6} className="text-[var(--muted-fg)]">No staff accounts found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmActionDialog
        open={!!pending}
        title={pending ? `Confirm ${pending.action.replaceAll("_", " ")} for ${pending.account.email}` : ""}
        description={pending?.action === "revoke"
          ? "This permanently removes the account's staff access. Sessions are immediately revoked."
          : pending?.action === "revoke_sessions"
            ? "All active sessions for this account will be signed out immediately."
            : pending?.action === "suspend"
              ? "This account will be blocked from signing in until reactivated."
              : undefined}
        confirmLabel={pending ? `Confirm ${pending.action.replaceAll("_", " ")}` : "Confirm"}
        requireReason={pending?.action === "revoke" || pending?.action === "revoke_sessions"}
        reasonLabel="Reason (audit trail)"
        reasonPlaceholder={pending?.action === "revoke" ? "Why is this account being revoked?" : "Why are these sessions being revoked?"}
        busy={!!busy}
        onConfirm={runConfirmedAction}
        onClose={() => setPending(null)}
      />
    </>
  );
}
