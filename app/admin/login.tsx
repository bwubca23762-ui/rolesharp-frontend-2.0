"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Shield } from "lucide-react";
import { Button, Label, Input, FieldError } from "@/components/ui/primitives";

export default function AdminLogin({ onOk }: { onOk: () => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Deep-link return: Google sign-in should land the operator back on the
  // admin route they were headed to, not always /admin.
  const [nextPath, setNextPath] = useState("/admin");
  useEffect(() => {
    const requested = window.location.pathname;
    if (requested.startsWith("/admin") && requested !== "/admin/login") setNextPath(requested);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (!code) return;
    const messages: Record<string, string> = {
      staff_google_unconfigured: "Staff Google sign-in is not configured.",
      staff_google_rate_limited: "Too many sign-in attempts. Try again shortly.",
      staff_google_state: "The sign-in request expired. Start again.",
      staff_access_denied: "This Google account is not approved for staff access.",
      staff_google_failed: "Google staff sign-in failed. Try again.",
    };
    setErr(messages[code] ?? "Staff sign-in failed.");
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password, totp }),
      });
      if (r.ok) return onOk();
      const j = await r.json().catch(() => ({}));
      setErr(j.error || "Invalid admin credentials");
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login-panel" aria-labelledby="admin-login-title">
        <LinkToSite />
        <header className="admin-login-heading">
          <span className="admin-login-mark"><Shield size={24} aria-hidden /></span>
          <h1 id="admin-login-title">RoleSharp Admin</h1>
          <p>Sign in with your approved staff Google account.</p>
        </header>

        <Button
          as="a"
          href={`/api/admin/auth/google/start?next=${encodeURIComponent(nextPath)}`}
          variant="primary"
          fullWidth
        >
          Continue with Google
        </Button>
        <FieldError>{err}</FieldError>

        <div className="admin-login-recovery">
          <button
            type="button"
            className="admin-recovery-toggle"
            onClick={() => setShowRecovery((visible) => !visible)}
            aria-expanded={showRecovery}
            aria-controls="admin-recovery-form"
          >
            {showRecovery ? "Hide recovery access" : "Use recovery access"}
            <ChevronDown size={16} aria-hidden />
          </button>
          <form id="admin-recovery-form" onSubmit={submit} hidden={!showRecovery}>
            <p>Use this for audited recovery with a staff password and authenticator.</p>
            <div>
              <Label htmlFor="admin-user">Username</Label>
              <Input id="admin-user" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <div className="admin-password-label">
                <Label htmlFor="admin-password">Admin password</Label>
                <button type="button" aria-controls="admin-password" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? "Hide password" : "Show password"}
                </button>
              </div>
              <Input id="admin-password" type={showPassword ? "text" : "password"} disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <div>
              <Label htmlFor="admin-totp">Authenticator code</Label>
              <Input id="admin-totp" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" />
            </div>
            <Button type="submit" variant="outline" fullWidth isLoading={busy}>Enter recovery session</Button>
          </form>
        </div>
      </section>
    </main>
  );
}

function LinkToSite() {
  return <a href="/" className="admin-login-back"><ArrowLeft size={16} aria-hidden /> Back to RoleSharp</a>;
}
