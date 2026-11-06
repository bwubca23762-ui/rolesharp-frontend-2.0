"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DataRow, PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { featuresFor, TIER_COLUMNS, FEATURE_ROWS } from "@/lib/tier-features";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { PromoPanel } from "../panels/promo-panel";
import { SocialRewardsPanel } from "../panels/social-rewards-panel";
import { GatewaysPanel } from "../panels/gateways-panel";
import { useAdminConfirm } from "../confirm-dialog";
import { adminFetchJson } from "../admin-helpers";

type LimitKey = "freeMonthly" | "premiumMonthly" | "studentMonthly";
type Limits = Record<LimitKey, number>;

const LIMIT_FIELDS: Array<{ key: LimitKey; label: string; hint: string }> = [
  { key: "freeMonthly", label: "Free resumes / month", hint: "Verified free accounts" },
  { key: "premiumMonthly", label: "Premium resumes / month", hint: "Paid and admin-granted accounts" },
  { key: "studentMonthly", label: "Student resumes / month", hint: "Confirmed student-offer accounts" },
];

export default function SettingsView({ canManage = false, canReadPayments = false, canManagePayments = false, canManageFlags = false, canReadJobs = false }: { canManage?: boolean; canReadPayments?: boolean; canManagePayments?: boolean; canManageFlags?: boolean; canReadJobs?: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [pricing, setPricing] = useState<any>(null);
  const [integrations, setIntegrations] = useState<any>(null);
  const [cache, setCache] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [limitDraft, setLimitDraft] = useState<Limits | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const limitsEdited = useRef(false);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true); setLoadError("");
    const read = async (path: string) => {
      try {
        const result = await adminFetchJson<any>(path, { cache: "no-store" });
        return result.ok ? result.data : null;
      } catch { return null; }
    };
    const [nextPricing, nextIntegrations, nextCache, nextSettings] = await Promise.all([
      canReadPayments ? read("/api/admin/pricing") : Promise.resolve(null), read("/api/admin/integrations"), read("/api/admin/cache"), read("/api/admin/settings"),
    ]);
    if (nextPricing) setPricing(nextPricing);
    if (nextIntegrations) setIntegrations(nextIntegrations);
    if (nextCache) setCache(nextCache);
    if (nextSettings) {
      setSettings(nextSettings);
      if (!limitsEdited.current) setLimitDraft({
        freeMonthly: nextSettings.limits?.freeMonthly ?? 0,
        premiumMonthly: nextSettings.limits?.premiumMonthly ?? 0,
        studentMonthly: nextSettings.limits?.studentMonthly ?? 0,
      });
    }
    const unavailable = [canReadPayments && !nextPricing && "pricing", !nextIntegrations && "integrations", !nextCache && "cache status", !nextSettings && "usage limits"].filter(Boolean);
    if (unavailable.length) setLoadError(`Could not load ${unavailable.join(", ")}. Existing settings were not changed.`);
    setSettingsLoading(false);
  }, [canReadPayments]);

  useAdminRefreshSignal(loadSettings);
  useEffect(() => { void loadSettings(); }, [loadSettings]);

  async function saveLimits() {
    if (!limitDraft) return;
    ask({
      title: "Apply new usage limits",
      body: `Free ${limitDraft.freeMonthly}/mo, Premium ${limitDraft.premiumMonthly}/mo, Student ${limitDraft.studentMonthly}/mo. Takes effect within a minute.`,
      word: "APPLY",
      run: async () => {
        setBusy("limits"); setMsg(null);
        try {
          const r = await adminFetchJson<any>("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limits: limitDraft }),
          });
          const j = r.data ?? {};
          if (!r.ok) throw new Error(r.error);
          limitsEdited.current = false;
          setSettings((prev: any) => ({ ...prev, ...j }));
          if (j.limits) setLimitDraft({ freeMonthly: j.limits.freeMonthly, premiumMonthly: j.limits.premiumMonthly, studentMonthly: j.limits.studentMonthly });
          setMsg({ ok: "Usage limits updated. They apply platform-wide within a minute." });
        } catch (error) { setMsg({ error: "Could not save the new limits." }); throw error; }
        finally { setBusy(""); }
      },
    });
  }

  async function resetLimits() {
    ask({
      title: "Reset usage limits",
      body: "Remove the saved override and return to the env-configured limits.",
      word: "RESET",
      run: async () => {
        setBusy("reset"); setMsg(null);
        try {
          const r = await adminFetchJson<any>("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reset: true }),
          });
          const j = r.data ?? {};
          if (!r.ok) throw new Error(r.error);
          limitsEdited.current = false;
          setSettings((prev: any) => ({ ...prev, ...j, limits: j.limits }));
          if (j.limits) setLimitDraft({ freeMonthly: j.limits.freeMonthly, premiumMonthly: j.limits.premiumMonthly, studentMonthly: j.limits.studentMonthly });
          setMsg({ ok: "Override removed. Env-configured limits are active again." });
        } catch (error) { setMsg({ error: "Could not reset the limits." }); throw error; }
        finally { setBusy(""); }
      },
    });
  }

  async function purgeCache() {
    ask({
      title: "Purge the Cloudflare cache",
      body: "The entire zone cache is purged. Pages will be slower for a few minutes while it refills.",
      word: "PURGE",
      run: async () => {
        setBusy("cache"); setMsg(null);
        try {
          const r = await adminFetchJson("/api/admin/cache", { method: "POST" });
          if (r.ok) setMsg({ ok: "Cloudflare cache purged. Fresh pages will be served on next request." });
          else throw new Error(r.error);
        } catch (error) { setMsg({ error: "Cache purge was not confirmed." }); throw error; }
        finally { setBusy(""); }
      },
    });
  }

  async function pingIndexNow() {
    ask({
      title: "Submit to IndexNow",
      body: "The current public URL set is submitted to IndexNow, notifying Bing-powered search systems immediately.",
      word: "SUBMIT",
      run: async () => {
        setBusy("indexnow"); setMsg(null);
        try {
          const r = await adminFetchJson<{ ok?: boolean; count?: number; status?: number }>("/api/admin/indexnow", { method: "POST" });
          const j = r.data ?? {};
          if (r.ok && j.ok !== false) setMsg({ ok: `Submitted ${j.count ?? "?"} URLs to IndexNow (status ${j.status ?? "?"}).` });
          else throw new Error(r.error || "IndexNow submission failed.");
        } catch (error) { setMsg({ error: "IndexNow submission was not confirmed." }); throw error; }
        finally { setBusy(""); }
      },
    });
  }

  const p = pricing?.envPricing;
  const limitsDirty = !!limitDraft && !!settings?.limits && LIMIT_FIELDS.some(({ key }) => limitDraft[key] !== settings.limits[key]);
  return (
    <>
      <PageHeader title="Settings" desc="Usage limits, feature flags, pricing, integrations, SEO tools, and cache — the platform controls in one place." onRefresh={() => void loadSettings()} />
      {loadError && <Notice variant="danger" role="alert">{loadError}</Notice>}
      {msg?.ok && <Notice variant="success" role="status">{msg.ok}</Notice>}
      {msg?.error && <Notice variant="danger" role="alert">{msg.error}</Notice>}

      <div className="admin-chart-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: 14, fontWeight: 700 }}>Usage limits</h2>
          {settings?.overridden
            ? <Badge variant="warning">Override active</Badge>
            : <Badge variant="default">Env defaults</Badge>}
        </div>
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginTop: 8, marginBottom: 12 }}>
          Monthly generation allowances per plan tier. Changes save to the platform database and apply within a minute.
          {settings?.updatedAt && <> Last saved {new Date(settings.updatedAt).toLocaleString()}{settings.updatedBy ? ` by ${settings.updatedBy}` : ""}.</>}
        </p>
        {limitsDirty && <p className="mb-3 text-sm font-semibold" role="status">Unsaved changes — refreshing data will preserve these edits.</p>}
        {!limitDraft && <p className="text-[var(--muted-fg)]">{settingsLoading ? "Loading..." : "Usage limits are unavailable. Use Refresh to retry."}</p>}
        {limitDraft && (
          <>
            <div className="grid gap-4 sm:grid-cols-3" style={{ marginBottom: 12 }}>
              {LIMIT_FIELDS.map(({ key, label, hint }) => {
                const envValue = settings?.envLimits?.[key];
                return (
                  <label key={key} style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</span>
                    <input
                      className="admin-table-search"
                      style={{ width: "100%" }}
                      type="number"
                      min={key === "freeMonthly" ? 0 : 1}
                      max={10000}
                      disabled={!canManage || !!busy}
                      value={limitDraft[key]}
                      onChange={(event) => { limitsEdited.current = true; setLimitDraft({ ...limitDraft, [key]: Math.trunc(Number(event.target.value) || 0) }); }}
                      aria-label={label}
                    />
                    <small className="text-[var(--muted-fg)]" style={{ display: "block", marginTop: 4 }}>
                      {hint}{typeof envValue === "number" && envValue !== limitDraft[key] ? ` · env: ${envValue}` : ""}
                    </small>
                  </label>
                );
              })}
            </div>
            {canManage ? (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button size="compact" disabled={!limitsDirty || !!busy} onClick={saveLimits}>{busy === "limits" ? "Saving..." : "Save limits"}</Button>
                {settings?.overridden && <Button variant="outline" size="compact" disabled={!!busy} onClick={resetLimits}>{busy === "reset" ? "Resetting..." : "Reset to env defaults"}</Button>}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--muted-fg)]" style={{ margin: 0 }}>Read only — changing limits requires the system.manage permission (owner or admin role).</p>
            )}
          </>
        )}
      </div>

      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Tier features</h2>
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>
          What each tier can do, enforced server-side from one map (lib/tier-features.ts). Auto-Apply is reserved for the one-time Job Search Pack — it is intentionally off for every subscription tier.
        </p>
        <div className="admin-table-wrap" tabIndex={0} aria-label="Tier features matrix">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Function</th>
                {TIER_COLUMNS.map((tier) => <th key={tier.id} style={{ textAlign: "center" }}>{tier.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span className="cell-main">{row.label}{row.planned && <Badge variant="warning">Planned</Badge>}</span>
                    <span className="admin-data-row-detail">{row.hint}</span>
                  </td>
                  {TIER_COLUMNS.map((tier) => {
                    const features = featuresFor(tier.source, tier.premium);
                    const value = features[row.key];
                    // A planned row has no implementing route yet: it must not
                    // render a ✓ for any tier, or the console advertises vapor.
                    const text = row.planned
                      ? "Planned"
                      : typeof value === "boolean"
                        ? (value ? "✓" : "—")
                        : value === "full" ? "Full market" : value === "student" ? "Student filter" : "—";
                    return (
                      <td key={tier.id} style={{ textAlign: "center" }} className={!row.planned && value === true ? "text-[var(--color-primary)] font-semibold" : undefined}>{text}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(canManageFlags || canReadJobs) && <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Feature flags</h2>
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>Live switches have one guarded home so confirmations, errors, and workflow readiness are never bypassed.</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {canManageFlags && <Button as="a" variant="outline" size="compact" href="/admin/flags">Manage feature flags</Button>}
          {canReadJobs && <Button as="a" variant="outline" size="compact" href="/admin/workflows">Review workflow operations</Button>}
        </div>
      </div>}

      <div className={canReadPayments ? "grid-2" : "grid"} style={{ marginTop: 18 }}>
        {canReadPayments && <div className="admin-chart-card">
          <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Pricing</h2>
          {!p && <p className="text-[var(--muted-fg)]">{settingsLoading ? "Loading..." : "Pricing is unavailable. Use Refresh to retry."}</p>}
          {p && (
            <>
              <DataRow left="Monthly price" right={<b>${(p.monthlyCents / 100).toFixed(2)}</b>} />
              <DataRow left="Yearly price" right={<b>${(p.yearlyCents / 100).toFixed(2)}</b>} />
              <DataRow left="Monthly grant" right={<b>{p.daysMonthly} days</b>} />
              <DataRow left="Yearly grant" right={<b>{p.daysYearly} days</b>} />
              <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginTop: 10 }}>
                Prices are env-managed (<code>PRICE_*</code> on the VPS, restart <code>resume-web</code> to apply) so an
                invoice amount can never drift from what checkout advertised. Plan allowances are editable above.
              </p>
            </>
          )}
        </div>}
        <div className="admin-chart-card">
          <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Integrations</h2>
          {!integrations && <p className="text-[var(--muted-fg)]">{settingsLoading ? "Loading..." : "Integration status is unavailable. Use Refresh to retry."}</p>}
          {integrations && (
            <>
              <DataRow left="Database" right={<Badge variant={integrations.database?.ok ? "success" : "default"}>{integrations.database?.ok ? "OK" : "Error"}</Badge>} />
              <DataRow left="Redis" right={<Badge variant={integrations.redis?.ok ? "success" : "default"}>{integrations.redis?.ok ? `OK (${integrations.redis?.latency_ms ?? "?"}ms)` : "Error"}</Badge>} />
              <DataRow left="Transactional email" right={<Badge variant={integrations.smtp?.production_ready ? "success" : integrations.smtp?.configured ? "warning" : "default"}>{integrations.smtp?.production_ready ? "Ready" : integrations.smtp?.configured ? "Direct VPS · at risk" : "Missing"}</Badge>} />
              <DataRow left="Google OAuth" right={<Badge variant={integrations.google_oauth?.configured ? "success" : "default"}>{integrations.google_oauth?.configured ? "Configured" : "Missing"}</Badge>} />
              <DataRow left="NOWPayments" right={<Badge variant={integrations.nowpayments?.mode === "live" ? "success" : "warning"}>{integrations.nowpayments?.mode ?? "off"}</Badge>} />
              <DataRow left="Gemini keys" right={<Badge variant={integrations.gemini_keys?.configured ? "success" : "default"}>{integrations.gemini_keys?.configured ? `${integrations.gemini_keys?.provider_count} key(s)` : "None"}</Badge>} />
            </>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="admin-chart-card">
          <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>SEO &amp; indexing</h2>
          <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>Push key pages to IndexNow (Bing / Copilot / ChatGPT search) after content changes.</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {canManage && <Button size="compact" disabled={busy === "indexnow"} isLoading={busy === "indexnow"} onClick={pingIndexNow}>{busy === "indexnow" ? "Submitting..." : "Submit to IndexNow"}</Button>}
            <Button as="a" variant="outline" size="compact" href="/sitemap.xml" target="_blank" rel="noopener">sitemap.xml</Button>
            <Button as="a" variant="outline" size="compact" href="/robots.txt" target="_blank" rel="noopener">robots.txt</Button>
            <Button as="a" variant="outline" size="compact" href="/llms.txt" target="_blank" rel="noopener">llms.txt</Button>
          </div>
        </div>
        <div className="admin-chart-card">
          <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Cloudflare cache</h2>
          <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>
            {cache === null && !settingsLoading
              ? "Cache configuration status is unavailable. Use Refresh to retry."
              : cache?.configured
              ? "Purge everything after urgent content or bundle fixes so users get fresh pages immediately."
              : "Not configured — set CF_ZONE_ID and CF_PURGE_TOKEN in the server .env to enable one-click purge."}
          </p>
          {canManage && <Button variant="danger" size="compact" disabled={!cache?.configured || busy === "cache" || settingsLoading} onClick={purgeCache}>{busy === "cache" ? "Purging..." : "Purge entire cache"}</Button>}
        </div>
      </div>

      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>AI gateways</h2>
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>
          The provider chain every generation falls through: Claude proxy → Bynara → Gemini rotation → Atomesus.
          Edit base URLs, API keys, models, and rate caps here — overrides live in the database and apply within ~30 seconds.
        </p>
        <GatewaysPanel canManage={canManage} />
      </div>

      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Promo codes</h2>
        <PromoPanel canManage={canManage} />
      </div>
      {canReadPayments && <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Social follow rewards</h2>
        <SocialRewardsPanel canManage={canManagePayments} />
      </div>}
      {dialog}
    </>
  );
}
