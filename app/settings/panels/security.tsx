"use client";
import { useEffect, useState } from "react";
import { Button, Card, FieldError as FormError, Input, Label } from "@/components/ui/primitives";
import { Download, Lock, Shield } from "../../icons";
import FeatureSection from "../feature-section";

function ChangePassword({ hasPassword }: { hasPassword: boolean }) {
  const [cur, setCur] = useState(""); const [nx, setNx] = useState(""); const [msg, setMsg] = useState<any>(null); const [busy, setBusy] = useState(false);
  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: cur, next: nx }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: 1, t: "Password changed" }); setCur(""); setNx(""); } else setMsg({ t: j.error || "Could not change password." });
    } catch {
      setMsg({ t: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <FeatureSection icon={<Lock size={20} />} title="Password" description="Change it, or see when it was last updated.">
      {hasPassword ? (
        <>
          <Label htmlFor="cur-pw">Current password</Label>
          <Input id="cur-pw" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className="mb-4" />
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-4">
          This account was created with Google. You can set a password for email changes; account deletion also supports fresh Google reauthentication.
        </p>
      )}
      <Label htmlFor="new-pw">{hasPassword ? "New password" : "Create password"}</Label>
      <Input id="new-pw" type="password" autoComplete="new-password" minLength={10} maxLength={256} value={nx} onChange={(e) => setNx(e.target.value)} className="mb-4" />
      <Button variant="outline" onClick={save} disabled={busy || nx.length < 10 || nx.length > 256 || (hasPassword && !cur)} isLoading={busy}>
        {hasPassword ? "Change password" : "Create password"}
      </Button>
      {msg && (
        <p
          className={`mt-4 text-sm font-semibold ${msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}
          role={msg.ok ? "status" : "alert"}
        >
          {msg.t}
        </p>
      )}
    </FeatureSection>
  );
}

function DangerZone({ hasPassword }: { hasPassword: boolean }) {
  const [pw, setPw] = useState(""); const [confirm, setConfirm] = useState(false); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  useEffect(() => {
    setGoogleReady(new URLSearchParams(window.location.search).get("deleteReauth") === "ready");
  }, []);
  async function del() {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { window.location.href = "/"; return; }
      if (j.error === "google_reauthentication_required" && j.reauthUrl) { window.location.href = j.reauthUrl; return; }
      setMsg(j.error || "Could not delete account.");
    } catch {
      setMsg("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6 border-[var(--color-danger)]/30 dark:border-[var(--color-danger)]/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] flex items-center justify-center shrink-0">
          <Shield size={20} />
        </div>
        <h2 className="text-xl font-bold! font-[family-name:var(--font-display)]! tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
          Delete account
        </h2>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-4">
        Permanently deletes your account, profiles, resumes, packages, credentials, queued work, attempts, and notification history. Local mailbox credentials are erased before best-effort provider revocation. This cannot be undone.
      </p>
      {!hasPassword && !googleReady ? (
        <div><p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-3">This passwordless account requires a fresh Google identity check before deletion.</p><Button as="a" href="/api/account/delete/google/start" variant="danger">Reauthenticate with Google</Button></div>
      ) : !confirm ? (
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Delete my account
        </Button>
      ) : (
        <>
          {hasPassword ? <><Label htmlFor="del-pw">Type your password to confirm</Label><Input id="del-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className="mb-4" /></> : <p className="mb-4 text-sm font-semibold text-[var(--color-danger)]">Google reauthentication confirmed for 10 minutes. Permanently delete this account?</p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => setConfirm(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={del} disabled={busy || (hasPassword && pw.length === 0)} isLoading={busy}>
              {busy ? "Deleting..." : "Permanently delete"}
            </Button>
          </div>
        </>
      )}
      {msg && <FormError>{msg}</FormError>}
    </Card>
  );
}

// Data portability. The privacy policy has always told users they may request
// access and portability and that "product controls support ... exports"; until
// now there was no export anywhere in the app, so the only way to honour a
// request was by hand. Placed directly above deletion because that is where
// someone leaving looks, and taking your data with you is the step that should
// come first.
function ExportData() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text)] flex items-center justify-center shrink-0">
          <Download size={20} />
        </div>
        <h2 className="text-xl font-bold! font-[family-name:var(--font-display)]! tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
          Export your data
        </h2>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-4">
        Downloads a JSON file containing your account details, resumes and their
        content, tracked applications, support tickets, credit history, payment
        records, and communication preferences. Credentials and security tokens
        are never included.
      </p>
      <Button as="a" href="/api/account/export" variant="outline">
        Download my data
      </Button>
    </Card>
  );
}

export default function SecurityPanel({ hasPassword }: { hasPassword: boolean }) {
  return (<><ChangePassword hasPassword={hasPassword} /><ExportData /><DangerZone hasPassword={hasPassword} /></>);
}
