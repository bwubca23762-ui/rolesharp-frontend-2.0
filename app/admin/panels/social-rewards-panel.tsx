"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button } from "@/components/ui/primitives";
import { adminFetchJson } from "../admin-helpers";
import { socialProfileUrl } from "@/lib/social-profile-url";
import { useAdminConfirm } from "../confirm-dialog";

// Social follow rewards control: campaign toggle, per-platform credit amount,
// and the recent-claims ledger. Backed by /api/admin/social-rewards.
type Config = { active: boolean; credits_per_platform: number; daily_matches_days: number; review_required: boolean };
type Recent = { id: string; email: string; platform: string; handle: string; created_at: string; follow_attested_at?: string | null; review_status: string; requested_credits: number; review_note: string | null };

export function SocialRewardsPanel({ canManage = false }: { canManage?: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [claims, setClaims] = useState<Array<{ platform: string; count: number }>>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [credits, setCredits] = useState("1");
  const [dailyMatchesDays, setDailyMatchesDays] = useState("15");
  const [active, setActive] = useState(true);
  const [reviewRequired, setReviewRequired] = useState(true);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const configLoaded = useRef(false);
  const { ask, dialog } = useAdminConfirm();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
        const result = await adminFetchJson<{ config: Config; claims: Array<{ platform: string; count: number }>; recent: Recent[]; total: number }>(`/api/admin/social-rewards?status=${status}&page=${page}`, { cache: "no-store" });
        if (!result.ok || !result.data) throw new Error(result.error);
        const data = result.data;
        setLoadError(null);
        setConfig(data.config);
        if (!configLoaded.current) {
        setCredits(String(data.config?.credits_per_platform ?? 1));
        setDailyMatchesDays(String(data.config?.daily_matches_days ?? 15));
        setActive(Boolean(data.config?.active));
        setReviewRequired(data.config.review_required);
        configLoaded.current = true;
        }
        setClaims(data.claims ?? []);
        setRecent(data.recent ?? []);
        setTotalRows(data.total);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Could not load the campaign configuration."); }
  }, [status, page]);
  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async () => {
    if (!credits.trim() || !dailyMatchesDays.trim()) { setMsg({ ok: false, text: "Enter credits and access days; use 0 to disable a reward." }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const result = await adminFetchJson<{ config: Config }>("/api/admin/social-rewards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active, creditsPerPlatform: Number(credits), dailyMatchesDays: Number(dailyMatchesDays), reviewRequired }),
      });
      if (!result.ok || !result.data) throw new Error(result.error || "Save failed.");
      setConfig(result.data.config);
      setMsg({ ok: true, text: "Campaign configuration saved. Applies immediately." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setBusy(false);
    }
  }, [active, credits, dailyMatchesDays, reviewRequired]);

  function review(row: Recent, action: "approve" | "reject") {
    const note = notes[row.id]?.trim() ?? "";
    if (action === "reject" && note.length < 3) { setMsg({ ok: false, text: "Add a rejection reason for the user." }); return; }
    ask({ title: `${action === "approve" ? "Approve" : "Reject"} reward claim`, word: action === "approve" ? "APPROVE" : "REJECT", body: action === "approve" ? `Award ${row.requested_credits} credits to ${row.email}? The declared profile and follow attestation are not platform verification.` : `Reject this claim and show the supplied reason to ${row.email}? No credits will be granted.`, run: async () => {
      setBusy(true); setMsg(null);
      try {
        const result = await adminFetchJson<{ alreadyReviewed?: boolean }>("/api/admin/social-rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Number(row.id), action, note }) });
        if (!result.ok) throw new Error(result.error);
        await load();
        setMsg({ ok: true, text: result.data?.alreadyReviewed ? "This claim was already reviewed; no additional credits were granted." : "Review saved." });
      } catch (error) { setMsg({ ok: false, text: error instanceof Error ? error.message : "Review failed." }); throw error; }
      finally { setBusy(false); }
    } });
  }

  if (loadError) {
    return (
      <p className="text-sm font-semibold text-[var(--color-danger)]" role="alert">
        {loadError} <Button variant="outline" size="compact" onClick={() => window.location.reload()}>Retry</Button>
      </p>
    );
  }

  if (!config) {
    return (
      <div aria-busy="true">
        {[0, 1, 2].map((row) => <div key={row} className="h-8 animate-pulse rounded-md bg-[color-mix(in_oklab,var(--muted-fg)_12%,transparent)]" style={{ marginTop: 8 }} />)}
      </div>
    );
  }

  const total = claims.reduce((sum, row) => sum + Number(row.count ?? 0), 0);

  return (
    <div>
      <p className="text-[13px] text-[var(--muted-fg)]">
        Follow-to-credits campaign (X / LinkedIn / Instagram). Users claim once per platform with their
        handle and an explicit follow attestation; claims are not verified through the social platforms. A handle can only ever claim once across all accounts. When review is required, credits and bonus eligibility wait for approval. Approved claims on every platform unlock a Daily Matches access window once per account. The user starts the timer after the matching feature is enabled.{" "}
        {total} total claim{total === 1 ? "" : "s"} so far.
      </p>
      <div className="row" style={{ gap: 14, flexWrap: "wrap", marginTop: 12 }}>
        <label className="row" style={{ gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={active} disabled={!canManage} onChange={(e) => setActive(e.target.checked)} />
          <b>Campaign active</b>
        </label>
        <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={reviewRequired} disabled={!canManage || busy} onChange={(event) => setReviewRequired(event.target.checked)} /><b>Require staff approval for new claims</b></label>
        <label className="row" style={{ gap: 8, alignItems: "center" }}>
          <span>Credits per platform:</span>
          <input
            type="number"
            disabled={!canManage}
            min={0}
            max={100}
            value={credits}
            onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))}
            className="field"
            style={{ width: 90 }}
            aria-label="Credits per platform claim"
          />
        </label>
        <label className="row" style={{ gap: 8, alignItems: "center" }}>
          <span>Daily Matches access days (all platforms):</span>
          <input
            type="number"
            disabled={!canManage}
            min={0}
            max={365}
            value={dailyMatchesDays}
            onChange={(e) => setDailyMatchesDays(e.target.value.replace(/\D/g, ""))}
            className="field"
            style={{ width: 90 }}
            aria-label="Daily Matches access days for claiming all platforms"
          />
        </label>
        {canManage && <Button type="button" disabled={busy} isLoading={busy} onClick={() => void save()}>
          {busy ? "Saving..." : "Save configuration"}
        </Button>}
      </div>
      {msg && <p className="text-[13px] font-semibold" style={{ marginTop: 10 }} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <label className="mt-4 block text-sm">Claim status <select className="admin-table-filter ml-2" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>{["all", "pending", "approved", "rejected"].map((value) => <option key={value}>{value}</option>)}</select></label>
      {recent.length === 0 && <p className="mt-3 text-sm">No claims match this filter.</p>}
      {recent.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>Recent claims</h3>
          <div className="admin-table-wrap"><table className="admin-table" style={{ width: "100%", fontSize: 12.5 }}>
            <thead><tr><th>When</th><th>User</th><th>Platform</th><th>Handle</th><th>Review</th></tr></thead>
            <tbody>
              {recent.map((row, i) => (
                <tr key={row.id ?? i}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.email}</td>
                  <td>{row.platform}</td>
                  <td>{socialProfileUrl(row.platform, row.handle) ? <a className="underline underline-offset-2" href={socialProfileUrl(row.platform, row.handle)!} target="_blank" rel="noopener noreferrer">@{row.handle} ↗</a> : `@${row.handle}`}<div className="mt-1"><Badge variant={row.follow_attested_at ? "info" : "warning"}>{row.follow_attested_at ? "Self-attested" : "Legacy claim"}</Badge></div></td>
                  <td><Badge variant={row.review_status === "pending" ? "warning" : row.review_status === "approved" ? "success" : "default"}>{row.review_status}</Badge>{row.review_note && <p>{row.review_note}</p>}{canManage && row.review_status === "pending" && <div className="mt-2 grid gap-2"><input aria-label={`Review reason for ${row.handle}`} maxLength={1000} className="field" value={notes[row.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Reason shown to user" /><div className="flex gap-2"><Button size="compact" disabled={busy} onClick={() => review(row, "approve")}>Approve</Button><Button size="compact" variant="outline" disabled={busy} onClick={() => review(row, "reject")}>Reject</Button></div></div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
      {totalRows > 20 && <div className="mt-3 flex items-center gap-3"><Button size="compact" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="text-xs">{page} / {Math.ceil(totalRows / 20)}</span><Button size="compact" variant="outline" disabled={page * 20 >= totalRows} onClick={() => setPage((value) => value + 1)}>Next</Button></div>}
      {dialog}
    </div>
  );
}
