"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { useAdminConfirm } from "../confirm-dialog";
import { adminFetchJson } from "../admin-helpers";

type GatewayRow = {
  id: string;
  overridden: boolean;
  envBaseUrl: string | null;
  envModel: string | null;
  envRpm: number | null;
  hasEnvKey: boolean;
  override: { baseUrl: string | null; model: string | null; rpm: number | null; keyTail: string | null } | null;
};

const GATEWAY_META: Record<string, { name: string; blurb: string; fields: Array<"baseUrl" | "apiKey" | "model" | "rpm"> }> = {
  claudeProxy: {
    name: "Claude proxy (premium tier)",
    blurb: "Anthropic-format proxy. First choice for premium generations.",
    fields: ["baseUrl", "apiKey", "model"],
  },
  bynara: {
    name: "Bynara router",
    blurb: "OpenAI-compatible Claude-class router. Premium fallback, then general fallback when Gemini is exhausted.",
    fields: ["baseUrl", "apiKey", "model", "rpm"],
  },
  geminiKeys: {
    name: "Gemini rotation (free tier)",
    blurb: "Comma-separated keys; round-robin with cooldown. The free-tier workhorse for every generator and the checker.",
    fields: ["apiKey", "model"],
  },
  atomesus: {
    name: "Atomesus (last resort)",
    blurb: "Credit-backed final fallback when every other provider fails.",
    fields: ["baseUrl", "apiKey", "model"],
  },
};

type Draft = Record<string, { baseUrl?: string; apiKey?: string; model?: string; rpm?: string }>;
type PaymentGateway = { id: string; name: string; configured: boolean; mode: string; currency: string; confirmation: string; verificationConfigured: boolean };

export function GatewaysPanel({ canManage }: { canManage: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [rows, setRows] = useState<GatewayRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentGateway[]>([]);
  const [rotation, setRotation] = useState<{ total: number; available: number; cooling: number } | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  // Fields the operator actually touched this editing session. An empty input
  // now means "clear this override field" and still counts as dirty — the old
  // all-empty-means-unchanged rule made a single cleared field unsavable.
  const [touched, setTouched] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [showKeyField, setShowKeyField] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const r = await adminFetchJson<{ gateways: GatewayRow[]; payments: PaymentGateway[]; geminiRotation: { total: number; available: number; cooling: number } }>("/api/admin/gateways", { cache: "no-store" });
      if (!r.ok || !r.data) throw new Error(r.error);
      const j = r.data;
      setRows(j.gateways ?? []);
      setPayments(j.payments ?? []);
      setRotation(j.geminiRotation ?? null);
    } catch {
      setRows([]);
      setMsg({ error: "Could not load gateway configuration." });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function setField(id: string, field: string, value: string) {
    setTouched((prev) => ({ ...prev, [id]: (prev[id] ?? []).includes(field) ? prev[id] : [...(prev[id] ?? []), field] }));
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function clearField(id: string, field: string) {
    setTouched((prev) => ({ ...prev, [id]: (prev[id] ?? []).filter((f) => f !== field) }));
    setDraft((prev) => {
      const next = { ...prev[id] };
      delete next[field as keyof typeof next];
      return { ...prev, [id]: next };
    });
  }

  async function save(id: string) {
    const fields = touched[id] ?? [];
    if (!fields.length) return;
    const all = draft[id] ?? {};
    // Only touched fields are sent, so an intentionally cleared input ("")
    // clears exactly that override field instead of being skipped.
    const changes: Record<string, string> = {};
    for (const field of fields) changes[field] = all[field as keyof typeof all] ?? "";
    setBusy(id); setMsg(null);
    try {
      const r = await adminFetchJson("/api/admin/gateways", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: { [id]: changes } }),
      });
      if (!r.ok) { setMsg({ error: r.error || "Save failed." }); return; }
      setMsg({ ok: `${GATEWAY_META[id]?.name ?? id} updated. Applies within ~30 seconds — no deploy needed.` });
      setDraft((prev) => ({ ...prev, [id]: {} }));
      setTouched((prev) => ({ ...prev, [id]: [] }));
      await load();
    } catch { setMsg({ error: "Network error." }); }
    finally { setBusy(""); }
  }

  async function resetToEnv(id: string) {
    const name = GATEWAY_META[id]?.name ?? id;
    ask({
      title: "Remove gateway override",
      body: `Remove the override for ${name}? The .env-configured values become active again.`,
      word: "REMOVE",
      run: async () => {
        setBusy(id); setMsg(null);
        try {
          const r = await adminFetchJson("/api/admin/gateways", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reset: true, id }),
          });
          if (!r.ok) throw new Error(r.error || "Reset failed.");
          setMsg({ ok: `${name} returned to .env configuration.` });
          await load();
        } catch (error) { setMsg({ error: "Gateway reset was not confirmed." }); throw error; }
        finally { setBusy(""); }
      },
    });
  }

  if (rows === null) return <p className="text-[var(--muted-fg)]">Loading gateways...</p>;

  return (
    <div className="grid gap-4">
      {msg?.ok && <Notice variant="success" role="status">{msg.ok}</Notice>}
      {msg?.error && <Notice variant="danger" role="alert">{msg.error}</Notice>}
      {payments.length > 0 && <section><h2 className="mb-3 text-base font-semibold">Payment gateways</h2><div className="grid gap-3 md:grid-cols-2">{payments.map((payment) => <div key={payment.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">{payment.name}</h3><Badge variant={payment.configured && payment.mode === "Live" ? "success" : "warning"}>{payment.mode}</Badge></div><p className="text-sm">Checkout currency: {payment.currency}</p><p className="mt-2 text-sm">{payment.confirmation}</p><p className="mt-2 text-sm">Verification credential: {payment.verificationConfigured ? "Configured" : "Missing"}</p><p className="mt-3 text-xs text-[var(--muted-fg)]">Configuration status does not confirm a successful payment or webhook delivery.</p></div>)}</div></section>}

      {rotation && (
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ margin: 0 }}>
          Gemini rotation right now: {rotation.available}/{rotation.total} keys available{rotation.cooling > 0 ? `, ${rotation.cooling} cooling down` : ""}.
          Changes here apply platform-wide within about 30 seconds — no deploy required.
        </p>
      )}

      {rows.map((row) => {
        const meta = GATEWAY_META[row.id];
        const d = draft[row.id] ?? {};
        const dirty = (touched[row.id] ?? []).length > 0;
        return (
          <div key={row.id} className="admin-chart-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{meta?.name ?? row.id}</h3>
              {row.overridden ? <Badge variant="warning">Override active</Badge> : <Badge variant="default">.env config</Badge>}
            </div>
            <p className="text-[12px] text-[var(--muted-fg)]" style={{ marginTop: 6, marginBottom: 10 }}>{meta?.blurb}</p>

            {!canManage ? (
              <div>
                <DataRow2 label="Base URL" value={row.override?.baseUrl ?? row.envBaseUrl ?? "—"} />
                <DataRow2 label="Model" value={row.override?.model ?? row.envModel ?? "—"} />
                <DataRow2 label="Key" value={row.override?.keyTail ?? (row.hasEnvKey ? "(from .env)" : "not configured")} />
                {meta?.fields.includes("rpm") && <DataRow2 label="RPM cap" value={String(row.override?.rpm ?? row.envRpm ?? "—")} />}
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {meta?.fields.includes("baseUrl") && (
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Base URL</span>
                      <input className="admin-table-search" style={{ width: "100%" }} placeholder={row.override?.baseUrl ?? row.envBaseUrl ?? "https://..."} disabled={busy === row.id}
                        value={d.baseUrl ?? ""} onChange={(e) => setField(row.id, "baseUrl", e.target.value)} aria-label={`${meta.name} base URL`} />
                      <small className="text-[var(--muted-fg)]">current: {(row.override?.baseUrl ?? row.envBaseUrl) || "—"}</small>
                    </label>
                  )}
                  {meta?.fields.includes("model") && (
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Model</span>
                      <input className="admin-table-search" style={{ width: "100%" }} placeholder={row.override?.model ?? row.envModel ?? "model-name"} disabled={busy === row.id}
                        value={d.model ?? ""} onChange={(e) => setField(row.id, "model", e.target.value)} aria-label={`${meta.name} model`} />
                      <small className="text-[var(--muted-fg)]">current: {(row.override?.model ?? row.envModel) || "—"}</small>
                    </label>
                  )}
                  {meta?.fields.includes("apiKey") && (
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>API key</span>
                      {showKeyField[row.id] ? (
                        <span style={{ display: "flex", gap: 6 }}>
                          <input className="admin-table-search" style={{ width: "100%" }} type="password" autoComplete="off" placeholder={(row.override?.keyTail || row.hasEnvKey) ? "paste new key to replace" : "paste API key"} disabled={busy === row.id}
                            value={d.apiKey ?? ""} onChange={(e) => setField(row.id, "apiKey", e.target.value)} aria-label={`${meta.name} API key`} />
                          <Button variant="ghost" size="compact" onClick={() => { clearField(row.id, "apiKey"); setShowKeyField((p) => ({ ...p, [row.id]: false })); }}>
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <Button variant="outline" size="compact" onClick={() => setShowKeyField((p) => ({ ...p, [row.id]: true }))}>
                          {row.override?.keyTail ? `Replace key (${row.override.keyTail})` : row.hasEnvKey ? "Replace key (.env)" : "Set key"}
                        </Button>
                      )}
                    </label>
                  )}
                  {meta?.fields.includes("rpm") && (
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Requests per minute</span>
                      <input className="admin-table-search" style={{ width: "100%" }} type="number" min={1} max={10000} placeholder={String(row.override?.rpm ?? row.envRpm ?? 10)} disabled={busy === row.id}
                        value={d.rpm ?? ""} onChange={(e) => setField(row.id, "rpm", e.target.value)} aria-label={`${meta.name} requests per minute`} />
                    </label>
                  )}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <Button size="compact" disabled={!dirty || !!busy} onClick={() => save(row.id)}>{busy === row.id ? "Saving..." : "Save"}</Button>
                  {row.overridden && <Button variant="outline" size="compact" disabled={!!busy} onClick={() => resetToEnv(row.id)}>Reset to .env</Button>}
                </div>
              </>
            )}
          </div>
        );
      })}
      {dialog}
    </div>
  );
}

function DataRow2({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--divider)", fontSize: 13 }}>
      <span className="text-[var(--muted-fg)]">{label}</span>
      <b>{value}</b>
    </div>
  );
}
