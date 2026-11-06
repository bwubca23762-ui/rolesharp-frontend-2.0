"use client";

import { useState } from "react";
import { DataRow, PageHeader, StatCard, useAdminRefreshSignal } from "../admin-shared";
import { Button, Notice } from "@/components/ui/primitives";
import type { AdminStats as S } from "../admin-types";
import { formatBytes, formatDuration, formatMs, formatPct } from "../admin-helpers";
import BackupPanel from "../panels/backup-panel";
import LogViewer from "../panels/log-viewer";
import JobIngestionPanel from "../panels/job-ingestion-panel";
import RateLimitPanel from "../panels/rate-limit-panel";
import ServicePanel from "../panels/service-panel";
import { useAdminConfirm } from "../confirm-dialog";
import { fetchJson, useAdminQuery } from "../query-client";

export default function SystemView({ s, onRefresh, canManage = false, canReadJobs = false, canReadSecurity = false }: { s: S; onRefresh: () => void; canManage?: boolean; canReadJobs?: boolean; canReadSecurity?: boolean }) {
  const sys = s.system;
  const queue = s.health?.queueCounts || {};
  const { ask, dialog } = useAdminConfirm();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const { data: integrations, isError: integrationsError, refetch: refreshIntegrations } = useAdminQuery<any>(
    ["admin", "integrations"], (signal) => fetchJson("/api/admin/integrations", { signal }),
  );
  useAdminRefreshSignal(() => { void refreshIntegrations(); });

  async function runQueueAction(action: string) {
    setBusy(action); setMsg("");
    try {
      const r = await fetch("/api/admin/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error === "queue_unavailable" ? "Queue is unreachable (Redis down?)." : "Action failed."); return; }
      setMsg(action === "retryFailed" ? `Retried ${j.retried}/${j.of} failed jobs.` : `Removed ${j.removed} jobs.`);
      onRefresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Queue action failed. Try again.");
    } finally { setBusy(""); }
  }

  function queueAction(action: string, title: string, body: string, word: string) {
    ask({ title, body, word, run: () => runQueueAction(action) });
  }

  return (
    <>
      <PageHeader title="System & Process" desc="Server speed, process memory, queue state, and runtime capacity." onRefresh={onRefresh} />

      <div className="admin-stat-grid">
        <StatCard label="Hostname" value={sys.hostname} />
        <StatCard label="Node" value={sys.node} />
        <StatCard label="CPU cores" value={sys.cpuCount} />
        <StatCard label="VPS uptime" value={formatDuration(sys.uptimeSec)} />
        <StatCard label="Web uptime" value={formatDuration(sys.processUptimeSec)} />
        <StatCard label="Load 1m" value={Number(sys.loadAvg?.[0] ?? 0).toFixed(2)} />
        <StatCard label="RAM free" value={formatBytes(sys.freeMem)} />
        <StatCard label="RAM total" value={formatBytes(sys.totalMem)} />
        <StatCard label="Process RSS" value={formatBytes(sys.rss)} />
        <StatCard label="Heap used" value={formatBytes(sys.heapUsed)} />
        <StatCard label="Disk used" value={sys.disk ? `${sys.disk.usedPct}%` : "-"} accent={(sys.disk?.usedPct ?? 0) > 85 ? "red" : undefined} />
        <StatCard label="Memory used" value={formatPct(100 - (sys.freeMem / sys.totalMem) * 100)} />
      </div>

      <div className="grid-2">
        <div className="admin-chart-card">
          <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Queue state</h3>
          <div className="admin-stat-grid" style={{ marginTop: 12, marginBottom: 12 }}>
            <StatCard label="Waiting" value={queue.waiting ?? 0} />
            <StatCard label="Active" value={queue.active ?? 0} />
            <StatCard label="Completed" value={queue.completed ?? 0} />
            <StatCard label="Failed" value={queue.failed ?? 0} accent={queue.failed ? "red" : undefined} />
          </div>
          {canManage && <div className="row" style={{ gap: 8 }}>
            <Button variant="outline" size="compact" disabled={!!busy} isLoading={busy === "retryFailed"} onClick={() => queueAction("retryFailed", "Retry failed jobs", "Every failed job is retried immediately, up to its attempt cap.", "RETRY")}>Retry failed</Button>
            <Button variant="outline" size="compact" disabled={!!busy} isLoading={busy === "cleanFailed"} onClick={() => queueAction("cleanFailed", "Clean failed jobs", "Failed jobs older than 1 hour are removed from the queue.", "CLEAN")}>Clean failed</Button>
            <Button variant="outline" size="compact" disabled={!!busy} isLoading={busy === "cleanCompleted"} onClick={() => queueAction("cleanCompleted", "Clean completed jobs", "Completed jobs older than 24 hours are removed from the queue history.", "PURGE")}>Clean completed</Button>
          </div>}
          {msg && <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginTop: 10 }}>{msg}</p>}
        </div>

        <div className="admin-chart-card">
          <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Generation speed</h3>
          <div className="admin-stat-grid" style={{ marginTop: 12, marginBottom: 0 }}>
            <StatCard label="Average" value={formatMs(s.totals.avgGenMs)} />
            <StatCard label="P95" value={formatMs(s.totals.p95GenMs)} />
            <StatCard label="Free avg" value={formatMs(s.totals.freeAvgGenMs)} />
            <StatCard label="Premium avg" value={formatMs(s.totals.premiumAvgGenMs)} />
          </div>
        </div>
      </div>

      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Slowest recent generations</h3>
        {s.recentSlow.length === 0 && <p className="text-[var(--muted-fg)]">No speed data yet.</p>}
        {s.recentSlow.map((r: any, i: number) => <DataRow key={i} left={`Generation - ATS ${r.ats_score ?? "-"}`} right={`${formatMs(r.gen_ms)} - ${new Date(r.created_at).toLocaleString()}`} />)}
      </div>

      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Integration Health</h3>
        {integrationsError && <Notice variant="danger" role="alert">Could not load integration health. <Button variant="outline" onClick={() => void refreshIntegrations()}>Retry integrations</Button></Notice>}
        {!integrations && !integrationsError && <p className="text-[var(--muted-fg)]">Loading...</p>}
        {integrations && !integrationsError && (
          <div className="admin-stat-grid" style={{ marginTop: 12, marginBottom: 0 }}>
            <StatCard
              label="Database"
              value={integrations.database?.ok ? "OK" : "Error"}
              accent={integrations.database?.ok ? "green" : "red"}
            />
            <StatCard
              label="Redis"
              value={integrations.redis?.ok ? `OK (${integrations.redis?.latency_ms ?? "?"}ms)` : "Error"}
              accent={integrations.redis?.ok ? "green" : "red"}
            />
            <StatCard
              label="SMTP"
              value={integrations.smtp?.configured ? `${integrations.smtp?.host}:${integrations.smtp?.port}` : "Not set"}
              accent={integrations.smtp?.configured ? "green" : "red"}
            />
            <StatCard
              label="Google OAuth"
              value={integrations.google_oauth?.configured ? "Configured" : "Missing"}
              accent={integrations.google_oauth?.configured ? "green" : "red"}
            />
            <StatCard
              label="NOWPayments"
              value={integrations.nowpayments?.mode ?? "off"}
              accent={integrations.nowpayments?.mode === "live" ? "green" : integrations.nowpayments?.mode === "dev" ? "amber" : "red"}
            />
            <StatCard
              label="LLM Proxy"
              value={integrations.llm_proxy?.configured ? (integrations.llm_proxy?.url ? integrations.llm_proxy.url : "Set") : "Not set"}
              accent={integrations.llm_proxy?.configured ? "green" : "red"}
            />
            <StatCard
              label="Gemini Keys"
              value={integrations.gemini_keys?.configured ? `${integrations.gemini_keys?.provider_count} key(s)` : "None"}
              accent={integrations.gemini_keys?.configured ? "green" : "red"}
            />
          </div>
        )}
      </div>

      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Services</h3>
        <ServicePanel canManage={canManage} />
      </div>

      {canReadJobs && <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Job Ingestion Health</h3>
        <JobIngestionPanel />
      </div>}

      {canReadSecurity && <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Rate Limit Status (Redis)</h3>
        <RateLimitPanel />
      </div>}

      {canManage && <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Database Backup</h3>
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>Trigger a manual PostgreSQL backup. Runs on the VPS via pg_dump. Large backups may take 30+ seconds.</p>
        <BackupPanel canManage={canManage} />
      </div>}

      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Recent System Logs</h3>
        <LogViewer />
      </div>
      {dialog}
    </>
  );
}
