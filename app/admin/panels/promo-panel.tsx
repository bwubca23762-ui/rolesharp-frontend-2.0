"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";
import { adminFetchJson } from "../admin-helpers";

type PromoCode = {
  code: string;
  percentage_off: number | null;
  amount_off_cents: number | null;
  applies_to: string[];
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: string | null;
  deactivated_at: string | null;
  created_at: string;
};

export function PromoPanel({ canManage = false }: { canManage?: boolean }) {
  const [codes, setCodes] = useState<PromoCode[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<{ code: string } | null>(null);
  // Create form
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(10);
  const [planId, setPlanId] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const load = useCallback(async (clearMessage = true) => {
    try {
      const r = await adminFetchJson<{ codes: PromoCode[] }>("/api/admin/promos", { cache: "no-store" });
      if (r.status === 403) { setCodes([]); setMsg({ ok: false, text: "You don't have permission to view promo codes." }); return; }
      if (!r.ok) { setCodes([]); setMsg({ ok: false, text: "Could not load promo codes." }); return; }
      const j = r.data ?? { codes: [] };
      setCodes(j.codes ?? []);
      if (clearMessage) setMsg(null);
    } catch { setCodes([]); setMsg({ ok: false, text: "Could not load promo codes." }); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (busy || !code.trim()) return;
    setBusy("create");
    try {
      const r = await adminFetchJson<{ code: string }>("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          code: code.trim().toUpperCase(),
          discountType,
          discountValue,
          ...(planId ? { planId } : {}),
          ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        }),
      });
      if (!r.ok) { setMsg({ ok: false, text: r.error || "Failed to create code." }); return; }
      setMsg({ ok: true, text: `Code ${r.data?.code ?? code.trim().toUpperCase()} created.` });
      setShowCreate(false);
      setCode(""); setDiscountValue(10); setMaxRedemptions(""); setExpiresAt("");
      await load(false);
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setBusy(""); }
  }

  // Deactivation is permanent — it goes through a confirmation dialog instead
  // of firing on the first click.
  async function deactivate(code: string) {
    setBusy(code);
    try {
      const r = await adminFetchJson("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate", code }),
      });
      if (!r.ok) {
        throw new Error(r.error || `Deactivating ${code} failed (status ${r.status}).`);
      } else {
        setMsg({ ok: true, text: `Code ${code} deactivated. Deactivation is permanent — create a new code to replace it.` });
      }
      await load(false);
    } catch (error) { setMsg({ ok: false, text: "Action failed. Try again." }); throw error; } finally { setBusy(""); }
  }

  return (
    <div>
      <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>
        Promo codes apply a discount at checkout. Percentage codes take 1–100; fixed codes are in cents.
        Codes can be plan-specific, capped on redemptions, and given an expiry date.
      </p>

      {msg && <Notice variant={msg.ok ? "success" : "danger"} role={msg.ok ? "status" : "alert"} className="mb-3">{msg.text}</Notice>}

      {canManage && !showCreate && (
        <Button variant="outline" size="compact" onClick={() => setShowCreate(true)}>Create promo code</Button>
      )}

      {canManage && showCreate && (
        <div className="rounded-xl border border-[var(--border)] p-4 mb-4 bg-[var(--surface)] dark:bg-[var(--surface-2)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="LAUNCH2026" maxLength={24}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm uppercase" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Discount type</span>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <option value="percentage">Percentage off (%)</option>
                <option value="fixed">Fixed amount off (cents)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{discountType === "percentage" ? "Percentage (1–100)" : "Amount off (cents)"}</span>
              <input type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))}
                min={1} max={discountType === "percentage" ? 100 : 99999999}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Plan (blank = all)</span>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <option value="">All plans</option>
                <option value="monthly">Monthly pass</option>
                <option value="yearly">Yearly pass</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Max redemptions (blank = unlimited)</span>
              <input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)}
                min={1} placeholder="e.g. 100"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Expires at (optional)</span>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="compact" onClick={() => void create()} disabled={!code.trim() || busy === "create"}>Create</Button>
            <Button variant="outline" size="compact" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {codes === null ? (
        <p className="text-[var(--muted-fg)]">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="text-[var(--muted-fg)]">No promo codes yet.</p>
      ) : (
        <>
        <table className="admin-table">
          <thead><tr><th>Code</th><th>Discount</th><th>Plans</th><th>Used</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {codes.map((c) => {
              const expired = c.expires_at != null && new Date(c.expires_at) <= new Date();
              const exhausted = c.max_redemptions != null && c.times_redeemed >= c.max_redemptions;
              const active = !c.deactivated_at && !expired && !exhausted;
              return (
                <tr key={c.code}>
                  <td className="cell-main font-mono">{c.code}<button type="button" className="ml-2 text-xs underline" aria-label={`Copy promo code ${c.code}`} onClick={async () => { try { await navigator.clipboard.writeText(c.code); setMsg({ ok: true, text: `${c.code} copied.` }); } catch { setMsg({ ok: false, text: "Clipboard unavailable. Select and copy the code manually." }); } }}>Copy</button></td>
                  <td>{c.percentage_off != null ? `${c.percentage_off}%` : `$${((c.amount_off_cents ?? 0) / 100).toFixed(2)}`}</td>
                  <td>{c.applies_to.length ? c.applies_to.join(", ") : "All"}</td>
                  <td className="num-col tabular">{c.times_redeemed}{c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}{c.max_redemptions != null && c.max_redemptions > 0 && <progress className="mt-1 block h-1.5 w-24" aria-label={`Redemptions for ${c.code}`} max={c.max_redemptions} value={Math.min(c.times_redeemed, c.max_redemptions)} />}</td>
                  <td>
                    <Badge variant={active ? "success" : exhausted ? "warning" : "default"}>
                      {c.deactivated_at ? "Deactivated" : expired ? "Expired" : exhausted ? "Exhausted" : "Active"}
                    </Badge>
                  </td>
                  <td>
                    {canManage && !c.deactivated_at && <Button variant="outline" size="compact" disabled={busy === c.code} onClick={() => setPendingDeactivate({ code: c.code })}>Deactivate</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ConfirmActionDialog
          open={!!pendingDeactivate}
          title="Deactivate promo code"
          description={`Deactivate ${pendingDeactivate?.code ?? ""}? Deactivation is permanent — the code can never be reactivated, so create a replacement if you still need it.`}
          confirmLabel="Deactivate code"
          busy={!!pendingDeactivate && busy === pendingDeactivate.code}
          onConfirm={async () => { const code = pendingDeactivate?.code; if (!code) { setPendingDeactivate(null); return; } await deactivate(code); setPendingDeactivate(null); }}
          onClose={() => setPendingDeactivate(null)}
        />
        </>
      )}
    </div>
  );
}
