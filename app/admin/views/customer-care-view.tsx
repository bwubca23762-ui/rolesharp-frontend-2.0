"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { adminFetchJson } from "../admin-helpers";
import { Badge, Button, Card as UICard } from "@/components/ui/primitives";

/**
 * Customer Care workspace — the owner's single pane for "who needs help right
 * now". Combines the three signals that answer that question instead of
 * making the owner hop between Support, Users, and Communications:
 *
 *   - open support tickets (with reply/resolve inline)
 *   - newest signups (spot confused users before they ticket)
 *   - recent premium payments (paying customers get answered first)
 *
 * Read-only toward the data it does not act on; actions stay in their home
 * workspaces so permissions remain exactly those of the underlying features.
 */

type TicketRow = { id: string; subject: string; email: string; name?: string | null; status: string; created_at: string };
type SignupRow = { id: string; email: string; created_at: string; premium_until: string | null };
type PaymentRow = { order_id: string; plan: string | null; status: string; price_amount: string | null; created_at: string };

export default function CustomerCareView({ canManageSupport = false }: { canManageSupport?: boolean }) {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [signups, setSignups] = useState<SignupRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    const read = async (url: string) => {
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
      return body;
    };
    const results = await Promise.allSettled([
      read("/api/admin/support"),
      read("/api/admin/users?list=1&page=1&pageSize=8&sort=created_at&dir=desc"),
      read("/api/admin/payments?page=1&pageSize=6"),
    ]);
    const [t, u, p] = results;
    if (t.status === "fulfilled" && t.value?.tickets) setTickets(t.value.tickets.filter((row: TicketRow) => row.status !== "resolved").slice(0, 12));
    else if (t.status === "rejected") setError((prev) => prev || "Support queue unavailable.");
    if (u.status === "fulfilled" && Array.isArray(u.value?.rows)) setSignups(u.value.rows.slice(0, 8));
    else if (u.status === "rejected") setError((prev) => prev || "Recent signups unavailable.");
    if (p.status === "fulfilled" && Array.isArray(p.value?.rows)) setPayments(p.value.rows.slice(0, 6));
    else if (p.status === "rejected") setError((prev) => prev || "Recent payments unavailable.");
  }, []);

  useAdminRefreshSignal(load);

  useEffect(() => { void load(); }, [load]);

  async function resolveTicket(id: string) {
    setNote("");
    setResolving(id);
    const result = await adminFetchJson<{ ok?: boolean }>(`/api/admin/support/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    if (result.ok) {
      setNote("Ticket resolved.");
      setTickets((cur) => (cur ?? []).filter((t) => t.id !== id));
    } else {
      setNote(result.error || "Could not resolve the ticket. Open Support for the full thread.");
    }
    setResolving((cur) => (cur === id ? null : cur));
  }

  return (
    <div>
      <PageHeader title="Customer care desk" desc="Everything that answers 'who needs us right now' — tickets, fresh signups, and paying customers in one screen." />
      {note && <p className="text-sm font-semibold text-[var(--success)] mb-3" role="status">{note}</p>}
      {error && <p className="text-sm font-semibold text-[var(--danger)] mb-3" role="alert">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Tickets */}
        <UICard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="m-0 text-base font-bold!">Open tickets</h3>
            <Button variant="outline" size="compact" onClick={() => void load()}>Refresh</Button>
          </div>
          {!tickets && <p className="text-sm text-[var(--muted-fg)]">Loading…</p>}
          {tickets && tickets.length === 0 && <p className="text-sm text-[var(--muted-fg)]">Queue is clear.</p>}
          {tickets && tickets.length > 0 && (
            <ul className="m-0 list-none space-y-2 p-0">
              {tickets.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{t.subject}</strong>
                    <span className="block truncate text-xs text-[var(--muted-fg)]">{t.email} · {new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </div>
                  <Badge variant={t.status === "open" ? "warning" : t.status === "answered" ? "info" : "success"}>{t.status}</Badge>
                  {canManageSupport && t.status !== "resolved" && (
                    <Button size="compact" variant="outline" onClick={() => void resolveTicket(t.id)} disabled={resolving === t.id} isLoading={resolving === t.id}>
                      Resolve
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </UICard>

        <div className="grid gap-5">
          {/* Newest signups */}
          <UICard className="p-5">
            <h3 className="m-0 mb-4 text-base font-bold!">Newest signups</h3>
            {!signups && <p className="text-sm text-[var(--muted-fg)]">Loading…</p>}
            {signups && signups.length === 0 && <p className="text-sm text-[var(--muted-fg)]">No accounts yet.</p>}
            {signups && signups.length > 0 && (
              <ul className="m-0 list-none space-y-1.5 p-0">
                {signups.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{u.email}</span>
                    {u.premium_until && new Date(u.premium_until) > new Date() && <Badge variant="premium">premium</Badge>}
                    <span className="shrink-0 text-xs text-[var(--muted-fg)]">{new Date(u.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </UICard>

          {/* Recent payments */}
          <UICard className="p-5">
            <h3 className="m-0 mb-4 text-base font-bold!">Recent payments</h3>
            {!payments && <p className="text-sm text-[var(--muted-fg)]">Loading…</p>}
            {payments && payments.length === 0 && <p className="text-sm text-[var(--muted-fg)]">No payments yet.</p>}
            {payments && payments.length > 0 && (
              <ul className="m-0 list-none space-y-1.5 p-0">
                {payments.map((p) => (
                  <li key={p.order_id} className="flex items-center gap-3 text-sm">
                    <span className="font-semibold">${p.price_amount ?? "?"}</span>
                    <span className="capitalize text-[var(--muted-fg)]">{p.plan ?? "premium"}</span>
                    <Badge variant={["finished", "confirmed"].includes(p.status) ? "success" : "warning"}>{p.status.replaceAll("_", " ")}</Badge>
                    <span className="ml-auto shrink-0 text-xs text-[var(--muted-fg)]">{new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </UICard>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-[var(--muted-fg)]">
        Full threads live in <a className="underline" href="/admin/support">Support</a>; account management in{" "}
        <a className="underline" href="/admin/users">Users</a>. This desk is a read-first surface — every action here also exists there.
      </p>
    </div>
  );
}
