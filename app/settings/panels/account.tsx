"use client";
import { toast } from "sonner";
import { useState } from "react";
import { Button, Input, Label } from "@/components/ui/primitives";
import { User } from "../../icons";
import FeatureSection from "../feature-section";

export default function ChangeEmail({ userId, email, onChange }: any) {
  const [v, setV] = useState(""); const [pw, setPw] = useState(""); const [msg, setMsg] = useState<any>(null); const [busy, setBusy] = useState(false);
  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/account/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: v, password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ ok: 1, t: j.verificationRequired ? "Verification sent. Your current email stays active until you verify the new address." : "Email updated" });
        setV(""); setPw(""); onChange();
      } else setMsg({ t: j.error || "Could not update email." });
    } catch {
      setMsg({ t: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <FeatureSection icon={<User size={20} />} title="Account email" description="The address you sign in with and receive verification at.">
      <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-4">
        Current: {email}
      </p>
      {userId && <div className="mb-6">
        <p className="text-sm font-semibold">Your user ID</p>
        <code className="block break-all text-sm my-2">{userId}</code>
        <Button variant="outline" onClick={async () => {
          try { await navigator.clipboard.writeText(userId); toast.success("User ID copied"); }
          catch { toast.error("Could not copy. Select and copy the ID above."); }
        }}>Copy user ID</Button>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Include this ID when contacting support about your account.</p>
      </div>}
      <Label htmlFor="new-email">New email</Label>
      <Input id="new-email" type="email" autoComplete="email" value={v} onChange={(e) => setV(e.target.value)} className="mb-4" />
      <Label htmlFor="email-confirm-pw">Confirm with password</Label>
      <Input id="email-confirm-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className="mb-4" />
      <Button variant="outline" onClick={save} disabled={busy || !v.trim() || !pw} isLoading={busy}>
        Update email
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
