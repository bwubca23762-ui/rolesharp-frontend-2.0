"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Notice } from "@/components/ui/primitives";
import { useAdminConfirm } from "../confirm-dialog";
import { adminFetchJson } from "../admin-helpers";
import { formatBytes } from "../admin-helpers";
import type { BackupSnapshot } from "@/lib/ops-control";

export default function BackupPanel({ canManage = false }: { canManage?: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[] | null>(null);
  const [listError, setListError] = useState("");
  const load = useCallback(async () => {
    const result = await adminFetchJson<{ snapshots: BackupSnapshot[] }>("/api/admin/backup", { cache: "no-store" });
    if (!result.ok) { setListError(result.error); return; }
    setListError(""); setSnapshots(result.data?.snapshots || []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function runBackup() {
    setBusy(true); setMsg(null);
    try {
      const result = await adminFetchJson<{ message?: string }>("/api/admin/backup", { method: "POST" });
      if (result.ok) { setMsg({ ok: true, text: result.data?.message || "Backup completed successfully." }); await load(); }
      else setMsg({ ok: false, text: result.error || "Backup failed." });
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setBusy(false); }
  }
  function backup() {
    ask({
      title: "Run PostgreSQL backup",
      body: "A new backup is created on the VPS now. This can use significant disk and database resources.",
      word: "BACKUP",
      run: runBackup,
    });
  }
  return (
    <div>
      {canManage && <Button onClick={backup} disabled={busy} isLoading={busy}>{busy ? "Running backup..." : "Run Backup Now"}</Button>}
      {msg && <Notice variant={msg.ok ? "success" : "danger"} role={msg.ok ? "status" : "alert"} className="mt-3">{msg.text}</Notice>}
      {listError && <Notice variant="danger" role="alert" className="mt-3">{listError} <Button variant="outline" size="compact" onClick={() => void load()}>Retry inventory</Button></Notice>}
      {!snapshots && !listError && <p role="status">Loading encrypted snapshot inventory…</p>}
      {snapshots && <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Encrypted archive</th><th>Size</th><th>Created</th></tr></thead><tbody>{snapshots.map((snapshot) => <tr key={snapshot.name}><td className="font-mono text-xs">{snapshot.name}</td><td>{formatBytes(snapshot.bytes)}</td><td>{new Date(snapshot.createdAt).toLocaleString()}</td></tr>)}{!snapshots.length && <tr><td colSpan={3}>No completed encrypted snapshots found.</td></tr>}</tbody></table></div>}
      {dialog}
    </div>
  );
}
