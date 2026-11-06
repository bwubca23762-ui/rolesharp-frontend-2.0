"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import { adminFetchJson } from "../admin-helpers";

// The four responses support writes over and over. Appended to the draft,
// never sent directly — the operator edits names and specifics before sending.
const CANNED_REPLIES: Array<{ label: string; body: string }> = [
  {
    label: "Verification help",
    body: "Please check your inbox and spam folder for the verification link. You can request a fresh link from Account Settings. If it still does not arrive, reply here so we can investigate delivery.",
  },
  {
    label: "Premium access",
    body: "Premium activates after your payment provider confirms payment. If Billing shows a completed payment but your pass is inactive, please send your order reference so we can investigate.",
  },
  {
    label: "Refund policy",
    body: "Premium is a one-time pass and never auto-renews. If something went wrong with your payment or the product isn't working as described, reply with your order ID and we'll make it right, including a refund where appropriate.",
  },
  {
    label: "Feature request",
    body: "Thanks for the suggestion — I've logged it for the team. We prioritize by how many users ask, so requests like yours genuinely shape the roadmap. I'll let you know if it ships.",
  },
];

export default function SupportView({ canManage = false }: { canManage?: boolean }) {
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [open, setOpen] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");
  const replyDrafts = useRef<Record<string, string>>({});
  const selectedTicket = useRef("");
  const listRequest = useRef(0);
  const threadRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);
  const [loadError, setLoadError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const load = useCallback(async (status?: string) => {
    const request = ++listRequest.current;
    const result = await adminFetchJson<{ tickets: any[]; openCount: number }>(`/api/admin/support${status ? `?status=${encodeURIComponent(status)}` : ""}`);
    if (request !== listRequest.current) return;
    if (!result.ok || !result.data) throw new Error(result.error || "Could not load support tickets.");
    const payload = result.data;
    setTickets(payload.tickets || []); setOpen(payload.openCount || 0); setLoadError("");
  }, []);
  const refresh = () => load(statusFilter || undefined).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load support tickets."));
  useAdminRefreshSignal(refresh);  useEffect(() => { void load().catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load support tickets.")); }, [load]);

  const loadOne = async (id: string) => {
    const request = ++threadRequest.current;
    const result = await adminFetchJson<{ ticket: any }>(`/api/admin/support/${id}`);
    if (request !== threadRequest.current || selectedTicket.current !== id) return;
    if (!result.ok || !result.data) throw new Error(result.error || "Could not load the ticket thread.");
    const payload = result.data;
    setSelected(payload.ticket); setLoadError("");
  };

  async function act(action: string) {
    if (!selected || busy) return;
    setBusy(true); setMessage(null);
    try {
      const result = await adminFetchJson(`/api/admin/support/${selected.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, message: action === "reply" ? reply.trim() : undefined }) });
      if (!result.ok) { setMessage({ error: result.error || "Support action failed." }); return; }
      setMessage({ ok: action === "reply" ? "Reply added to the ticket." : action === "resolve" ? "Ticket resolved." : "Ticket reopened." });
      if (action === "reply") { delete replyDrafts.current[selected.id]; setReply(""); }
      await loadOne(selected.id); await load(statusFilter || undefined);
    } catch {
      setMessage({ error: "Network error. The support action was not confirmed." });
    } finally { setBusy(false); }
  }

  if (!tickets && !loadError) return (
    <div style={{ padding: 24 }} aria-busy="true">
      <Skeleton variant="heading" width="10rem" />
      <div className="grid gap-2" style={{ marginTop: 12 }}>
        {[0, 1, 2, 3, 4, 5].map((row) => <Skeleton key={row} variant="table-row" />)}
      </div>
    </div>
  );
  return (
    <div>
      <PageHeader title="Support queue" desc="Read threads, reply to customers, resolve or reopen tickets." onRefresh={() => void refresh()} />
      {message?.ok && <Notice variant="success" role="status">{message.ok}</Notice>}
      {message?.error && <Notice variant="danger" role="alert">{message.error}</Notice>}
      {loadError && <Notice variant="danger" role="alert">{loadError} <Button variant="outline" size="compact" onClick={() => void load().catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load support tickets."))}>Retry</Button></Notice>}
      <div className="admin-support-grid" style={{ marginTop: 0 }}>
        <div>
          <div className="section-head-row"><h3 style={{ margin: 0 }}>Tickets</h3> {open > 0 && <Badge variant="warning">{open} open</Badge>}
            <select className="admin-table-filter" value={statusFilter} aria-label="Filter tickets by status" style={{ marginLeft: "auto" }}
              onChange={(e) => { setStatusFilter(e.target.value); void load(e.target.value || undefined).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load support tickets.")); }}>
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="answered">Answered</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="admin-ticket-list" style={{ marginTop: 12 }}>
            {!tickets?.length && !loadError && <p className="text-[var(--muted-fg)]">No tickets yet.</p>}
            {tickets?.map((t) => (
              <button key={t.id} disabled={busy} className={`admin-ticket-row ${selected?.id === t.id ? "active" : ""}`} onClick={() => { if (selected) replyDrafts.current[selected.id] = reply; selectedTicket.current = t.id; setReply(replyDrafts.current[t.id] ?? ""); setMessage(null); setSelected(t); void loadOne(t.id).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load the ticket thread.")); }}>
                <div style={{ flex: 1 }}>
                  <strong>{t.subject}</strong>
                  <span className="mt-0.5 block text-[12px] text-[var(--muted-fg)]">{t.email}{t.name ? ` (${t.name})` : ""} · {t.message_count} msg · {new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </div>
                <Badge variant={t.status === "open" ? "warning" : t.status === "answered" ? "info" : "success"}>{t.status}</Badge>
              </button>
            ))}
          </div>
        </div>
        <div>
          {!selected && (
            <div className="admin-chart-card" style={{ textAlign: "center", padding: 44 }}>
              <p className="text-[var(--muted-fg)]" style={{ margin: 0 }}>Select a ticket to view the thread and reply.</p>
            </div>
          )}
          {selected && (
            <div className="admin-ticket-detail">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{selected.subject}</strong>
                  <span className="text-[13px] text-[var(--muted-fg)]" style={{ display: "block" }}>{selected.email}{selected.name ? ` — ${selected.name}` : ""} · {selected.user_id_text ? "account linked" : "guest"}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {canManage && selected.status !== "resolved" && <Button size="compact" onClick={() => act("resolve")} disabled={busy} isLoading={busy}>Resolve</Button>}
                  {canManage && selected.status === "resolved" && <Button variant="outline" size="compact" onClick={() => act("reopen")} disabled={busy} isLoading={busy}>Reopen</Button>}
                </div>
              </div>
              <div className="ticket-thread">
                {(selected.messages || []).map((m: any) => (
                  <div key={m.id} className={`ticket-msg ${m.author}`}>
                    <div className="ticket-msg-meta">
                      <Badge>{m.author === "admin" ? "You" : "Customer"}</Badge>
                      <span className="text-[13px] text-[var(--muted-fg)]">{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div className="ticket-msg-body">{String(m.body)}</div>
                  </div>
                ))}
              </div>
              {canManage && selected.status !== "resolved" && (
                <div style={{ marginTop: 14 }}>
                  <label className="label" htmlFor="admin-ticket-reply">Reply</label>
                  {/* Canned replies: the four responses support writes most,
                      pre-written so tone stays consistent. Insert at cursor;
                      always editable before sending. */}
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[var(--muted-fg)]">Quick replies:</span>
                    {CANNED_REPLIES.map((canned) => (
                      <button
                        key={canned.label}
                        type="button"
                        className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-fg)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                        onClick={() => setReply((current) => (current ? `${current.trim()}\n\n${canned.body}` : canned.body))}
                      >
                        {canned.label}
                      </button>
                    ))}
                  </div>
                  <textarea id="admin-ticket-reply" className="field" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply to the customer..." maxLength={4000} style={{ marginBottom: 10 }} />
                  <Button onClick={() => act("reply")} disabled={busy || reply.trim().length < 8} isLoading={busy}>{busy ? "Sending..." : "Send reply"}</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
