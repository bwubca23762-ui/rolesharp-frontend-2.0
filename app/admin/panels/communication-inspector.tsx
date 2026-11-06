"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Input, Label, Notice, Select } from "@/components/ui/primitives";
import { Button } from "@/components/ui/admin/button";
import { adminFetchJson } from "../admin-helpers";
import { useAdminRefreshSignal } from "../admin-shared";
import { useAdminConfirm } from "../confirm-dialog";

type Inspector = {
  recipients: Array<{ id: string; recipient_email: string | null; status: string; subject: string; campaign_key: string; transport: string | null; provider_category: string | null; updated_at: string }>;
  suppressions: Array<{ id: string; email_fingerprint: string; scope: string; reason: string; created_at: string }>;
  stats: Array<{ status: string; count: number }>;
  estimate: { eligible: number; admitted: number } | null;
};

export default function CommunicationInspector({ canRecover, versionId }: { canRecover: boolean; versionId: string }) {
  const [data, setData] = useState<Inspector | null>(null);
  const [email, setEmail] = useState("");
  const [filter, setFilter] = useState({ email: "", status: "all" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useAdminConfirm();
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    const result = await adminFetchJson<Inspector>(`/api/admin/communications/inspector?${new URLSearchParams({ ...filter, versionId })}`, { cache: "no-store" });
    if (current !== request.current) return;
    if (!result.ok || !result.data) { setError("Outbox inspection is unavailable. Try loading it again."); return; }
    setData(result.data); setError("");
  }, [filter, versionId]);
  useAdminRefreshSignal(load);
  useEffect(() => { void load(); }, [load]);

  function recover() {
    ask({ title: "Recover expired claims", word: "RECOVER CLAIMS", body: "Return up to 100 expired claims to pending. Recipients with a provider attempt remain unchanged. Existing sending gates and consent checks still apply.", run: async () => {
      setBusy(true); setMessage("");
      try {
        const result = await adminFetchJson<{ recovered: number }>("/api/admin/communications/inspector", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "RECOVER CLAIMS" }) });
        if (!result.ok || !result.data) throw new Error(result.error || "Recovery was not confirmed.");
        setMessage(`Recovered ${result.data.recovered} expired claim(s).`);
        await load();
      } catch (cause) { const detail = cause instanceof Error ? cause.message : "Recovery failed."; setError(detail); throw cause; }
      finally { setBusy(false); }
    } });
  }

  return <section className="rsx-card mt-5 p-5" aria-label="Communication outbox inspector">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="m-0 text-lg font-semibold">Delivery outbox & suppressions</h2><p className="mt-1 text-sm text-admin-muted-fg">Latest 50 records per filter. Provider accepted means handed off for delivery; failed and unknown sends require investigation.</p></div>{canRecover && <Button variant="cyber" size="compact" disabled={busy} onClick={recover}>Recover expired claims</Button>}</div>
    <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setFilter((current) => ({ ...current, email: email.trim() })); }}>
      <div className="min-w-0 flex-1"><Label htmlFor="outbox-recipient">Exact recipient email</Label><Input id="outbox-recipient" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Search outbox and suppressions" /></div>
      <div><Label htmlFor="outbox-status">Outbox status</Label><Select id="outbox-status" value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}>{["all", "pending", "claimed", "sending", "provider_accepted", "failed", "unknown", "suppressed", "canceled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></div>
      <Button type="submit" variant="outline" size="compact">Search</Button><Button type="button" variant="ghost" size="compact" onClick={() => { setEmail(""); setFilter({ email: "", status: "all" }); }}>Clear</Button>
    </form>
    {error && <Notice variant="danger" role="alert">{error} <Button variant="outline" size="compact" onClick={() => void load()}>Retry</Button></Notice>}
    {message && <Notice variant="success" role="status">{message}</Notice>}
    {!data && !error && <p role="status">Loading outbox…</p>}
    {data && <>
      {data.estimate && <p className="mb-4 text-sm" role="status">Saved campaign audience: <strong>{data.estimate.eligible}</strong> currently eligible · <strong>{data.estimate.admitted}</strong> already admitted. Consent and suppression are checked again before delivery.</p>}
      <div className="mb-4 flex flex-wrap gap-2" aria-label="All outbox records by status">{data.stats.map((item) => <Badge key={item.status}>{item.status.replaceAll("_", " ")}: {item.count}</Badge>)}</div>
      <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Latest outbox recipients</caption><thead><tr><th>Recipient / campaign</th><th>Status</th><th>Transport / result</th><th>Updated</th></tr></thead><tbody>{data.recipients.map((row) => <tr key={row.id}><td><strong>{row.recipient_email || "Removed recipient"}</strong><small className="block">{row.campaign_key} · {row.subject}</small></td><td><Badge variant={row.status === "failed" || row.status === "unknown" ? "warning" : "default"}>{row.status.replaceAll("_", " ")}</Badge></td><td>{row.transport || "Not attempted"}{row.provider_category && <small className="block">{row.provider_category}</small>}</td><td>{new Date(row.updated_at).toLocaleString()}</td></tr>)}{!data.recipients.length && <tr><td colSpan={4}>No recipients match this filter.</td></tr>}</tbody></table></div>
      <h3 className="mt-5 text-sm font-semibold">Suppression records</h3><p className="text-xs text-admin-muted-fg">Search by exact email to check suppression. Stored fingerprints protect removed account addresses; records are immutable.</p>
      <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Latest suppression records</caption><thead><tr><th>Recipient fingerprint</th><th>Scope</th><th>Reason</th><th>Recorded</th></tr></thead><tbody>{data.suppressions.map((row) => <tr key={row.id}><td><code title={row.email_fingerprint}>{row.email_fingerprint.slice(0, 12)}…</code></td><td>{row.scope}</td><td>{row.reason}</td><td>{new Date(row.created_at).toLocaleString()}</td></tr>)}{!data.suppressions.length && <tr><td colSpan={4}>No suppression records match this search.</td></tr>}</tbody></table></div>
    </>}{dialog}
  </section>;
}
