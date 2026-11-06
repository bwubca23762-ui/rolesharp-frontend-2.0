"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Notice } from "@/components/ui/primitives";
import type { ServiceStatus } from "@/lib/ops-control";
import { useAdminConfirm } from "../confirm-dialog";
import { adminFetchJson } from "../admin-helpers";

const ERRORS: Record<string, string> = {
  helper_unavailable: "The ops helper is not reachable. Check: systemctl status rolesharp-ops-helper",
  helper_timeout: "The ops helper did not respond in time.",
  helper_closed: "The ops helper closed the connection.",
  forbidden: "Your account does not have system.manage.",
  stop_not_permitted_for_unit: "resume-web cannot be stopped from here -- it serves this panel. Use Restart.",
  unknown_unit: "That unit is not on the helper's allowlist.",
};

function stateColor(s: ServiceStatus): string {
  // Token colors, not hex literals — the admin theme must survive a light pass.
  if (s.activeState === "active") return "var(--success)";
  if (s.activeState === "activating" || s.activeState === "deactivating") return "var(--warning)";
  return "var(--danger)";
}

export default function ServicePanel({ canManage = false }: { canManage?: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [services, setServices] = useState<ServiceStatus[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminFetchJson<{ services: ServiceStatus[] }>("/api/admin/services", { cache: "no-store" });
      if (!result.ok) { setServices([]); setMsg({ ok: false, text: ERRORS[result.error] || result.error }); return; }
      setServices(result.data?.services || []);
    } catch {
      setServices([]);
      setMsg({ ok: false, text: "Network error reading service state." });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runServiceAction(unit: string, action: "start" | "stop" | "restart" | "reload") {
    setBusy(`${unit}:${action}`);
    setMsg(null);
    try {
      const result = await adminFetchJson<{ service?: ServiceStatus }>("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit, action }),
      });
      if (!result.ok) {
        setMsg({ ok: false, text: ERRORS[result.error] || result.error || `${action} could not be confirmed. Refresh service state before retrying.` });
      } else {
        setMsg({ ok: true, text: `${unit}: ${action} succeeded (${result.data?.service?.activeState ?? "unknown"}).` });
      }
    } catch {
      // A restart of resume-web tears down this very connection, so a network
      // error here is expected rather than a failure.
      setMsg({ ok: false, text: `${unit}: ${action} could not be confirmed. Refresh service state before retrying.` });
    } finally {
      setBusy("");
      setTimeout(() => { void load(); }, 1500);
    }
  }

  function act(unit: string, action: "start" | "stop" | "restart" | "reload") {
    const title = `${action.charAt(0).toUpperCase()}${action.slice(1)} ${unit}`;
    const body = action === "restart"
      ? "In-flight requests on this unit will be dropped."
      : action === "stop"
        ? "The unit stays down until you start it again."
        : action === "reload" ? "Reload this service's configuration through the ops helper." : "The unit is started through the ops helper.";
    ask({ title, body, word: action.toUpperCase(), run: () => runServiceAction(unit, action) });
  }

  if (!services) return <p className="text-[var(--muted-fg)]">Loading services...</p>;

  return (
    <div>
      <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>
        Actions run as root through a helper daemon restricted to these units. Every action is recorded in the admin audit log.
      </p>

      {services.length === 0 && <p className="text-[var(--muted-fg)]">No services reported.</p>}

      {services.map((s) => (
        <div key={s.unit} className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{s.unit}</div>
            <div className="text-[var(--muted-fg)]" style={{ fontSize: 12 }}>
              <span
                aria-hidden="true"
                style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: stateColor(s), marginRight: 6 }}
              />
              {s.activeState} / {s.subState}
              {s.unitFileState !== "enabled" && ` - unit file ${s.unitFileState}`}
              {s.restarts > 0 && ` - ${s.restarts} restart${s.restarts === 1 ? "" : "s"}`}
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexShrink: 0 }}>
            {canManage && s.canReload && <Button variant="outline" size="compact" disabled={!!busy} isLoading={busy === `${s.unit}:reload`} onClick={() => act(s.unit, "reload")}>Reload</Button>}
            {canManage && <Button variant="outline" size="compact" disabled={!!busy} isLoading={busy === `${s.unit}:restart`} onClick={() => act(s.unit, "restart")}>
              Restart
            </Button>}
            {canManage && (s.activeState === "active" ? (
              <Button variant="outline" size="compact" disabled={!!busy || !s.canStop} isLoading={busy === `${s.unit}:stop`} title={s.canStop ? undefined : "resume-web serves this panel; use Restart"} onClick={() => act(s.unit, "stop")}>
                Stop
              </Button>
            ) : (
              <Button variant="outline" size="compact" disabled={!!busy} isLoading={busy === `${s.unit}:start`} onClick={() => act(s.unit, "start")}>
                Start
              </Button>
            ))}
          </div>
        </div>
      ))}

      {msg && (
        <Notice variant={msg.ok ? "success" : "danger"} role={msg.ok ? "status" : "alert"} className="mt-3">
          {msg.text}
        </Notice>
      )}
      {dialog}
    </div>
  );
}
