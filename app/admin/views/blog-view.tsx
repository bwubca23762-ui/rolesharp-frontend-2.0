"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DataRow, PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { toast } from "sonner";
import { adminFetchJson } from "../admin-helpers";
import { useAdminConfirm } from "../confirm-dialog";

export default function BlogView({ canEdit = false }: { canEdit?: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [topic, setTopic] = useState("");
  const [indexNowBusy, setIndexNowBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [posts, setPosts] = useState<any[] | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");

  // The generation poll is created inside an async click handler, so React
  // cannot clean it up. Without this ref it kept fetching and calling setState
  // for 30 x 8s after the admin navigated away from the blog view.
  const pollRef = useRef<number | null>(null);
  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => stopPoll, [stopPoll]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/blog", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load blog generation state.");
    const nextJobs = payload.jobs || [];
    setPosts(payload.posts || []); setJobs(nextJobs); setLoadError("");
    return nextJobs as any[];
  }, []);
  useAdminRefreshSignal(() => { void load().catch(() => {}); });  useEffect(() => { void load().catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load blog generation state.")); }, [load]);

  async function generate() {
    const t = topic.trim();
    if (t.length < 6 || busy) return;
    setBusy(true); setMsg(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const r = await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: t, today }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ ok: true, text: j.already ? `"${t}" is already queued or running.` : `Queued "${t}" for durable generation.` });
        setTopic("");
        const generationJobId = String(j.generationJobId || "");
        let tries = 0;
        stopPoll();
        pollRef.current = window.setInterval(async () => {
          tries += 1;
          try {
            const nextJobs = await load();
            const tracked = nextJobs.find((job) => job.id === generationJobId);
            if (tracked?.status === "completed" || tracked?.status === "failed") {
              stopPoll();
              setMsg({
                ok: tracked.status === "completed",
                text: tracked.status === "completed"
                  ? `Published "${tracked.topic}" successfully.`
                  : `Generation failed for "${tracked.topic}". Review the request below and retry.`,
              });
              return;
            }
            if (tries >= 30) {
              stopPoll();
              setMsg({ ok: true, text: "Generation is still tracked below; refresh later if it remains queued." });
            }
          } catch (pollError) {
            if (tries >= 30) stopPoll();
            setLoadError(pollError instanceof Error ? pollError.message : "Could not refresh blog generation state.");
          }
        }, 8000);
      } else { setMsg({ ok: false, text: j.detail || j.error || "Generation failed." }); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setBusy(false); }
  }

  function del(slug: string) {
    ask({
      title: "Delete blog post",
      body: `/blog/${slug} is permanently deleted. This cannot be undone.`,
      word: "DELETE",
      run: async () => {
        setBusy(true);
        setMsg(null);
        try {
          const response = await fetch(`/api/admin/blog?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Delete failed.");
          setMsg({ ok: true, text: `Deleted /blog/${slug}.` });
          await load();
        } catch (error) {
          setMsg({ ok: false, text: error instanceof Error ? error.message : "Delete failed." });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <>
      <PageHeader title="Blog generator" desc="Type a topic. AI writes, humanizes, and publishes an SEO-optimized post in ~60-90 seconds." onRefresh={() => void load().catch(() => {})}>
        <Button
          variant="outline"
          size="compact"
          disabled={indexNowBusy}
          onClick={() => {
            setIndexNowBusy(true);
            void adminFetchJson<{ submitted?: number }>("/api/admin/indexnow", { method: "POST" }).then((result) => {
              if (result.ok) toast.success(`IndexNow push accepted (${result.data?.submitted ?? 0} URLs).`);
              else toast.error(result.error || "IndexNow push failed.");
            }).finally(() => setIndexNowBusy(false));
          }}
        >
          {indexNowBusy ? "Pushing…" : "Push to IndexNow"}
        </Button>
      </PageHeader>
      {loadError && <Notice variant="danger" role="alert">{loadError} <Button variant="outline" size="compact" type="button" onClick={() => void load().catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load blog generation state."))}>Retry</Button></Notice>}
      {canEdit && <div className="admin-chart-card" style={{ maxWidth: 720 }}>
        <label className="label">Topic or working title</label>
        <input className="field" placeholder="e.g. How to write a resume for a Product Manager role at Amazon" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") generate(); }} disabled={busy} />
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginTop: 8 }}>Runs outline → write (1500+ words) → humanize → FAQ. Takes ~60-90 seconds.</p>
        <Button onClick={generate} disabled={busy || topic.trim().length < 6} isLoading={busy} style={{ marginTop: 12 }}>{busy ? "Writing..." : "Generate & publish"}</Button>
        {msg && <Notice variant={msg.ok ? "success" : "danger"} role={msg.ok ? "status" : "alert"} className="mt-3">{msg.text}</Notice>}
      </div>}

      {jobs.length > 0 && (
        <div className="admin-chart-card" style={{ marginTop: 18 }}>
          <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Generation requests</h3>
          {jobs.slice(0, 10).map((job) => (
            <DataRow key={job.id} left={<span><b>{job.topic}</b><span className="admin-data-row-detail">{job.publish_date}</span></span>}
              right={<Badge variant={job.status === "completed" ? "success" : job.status === "failed" ? "default" : "warning"}>{job.status}</Badge>} />
          ))}
        </div>
      )}

      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Generated posts ({posts?.length ?? 0})</h3>
        {!posts && <p className="text-[var(--muted-fg)]">Loading...</p>}
        {posts?.length === 0 && <p className="text-[var(--muted-fg)]">None yet. Generate your first post above.</p>}
        {posts?.map((p) => (
          <DataRow key={p.slug} left={<span><b>{p.title}</b><span className="admin-data-row-detail">/blog/{p.slug}</span></span>}
            right={<div className="row" style={{ gap: 6 }}><Button as="a" variant="outline" size="compact" href={`/blog/${p.slug}`} target="_blank" rel="noopener">View</Button>{canEdit && <Button variant="danger" size="compact" onClick={() => del(p.slug)}>Delete</Button>}</div>} />
        ))}
      </div>
      {dialog}
    </>
  );
}
