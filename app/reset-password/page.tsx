"use client";

import { useEffect, useState } from "react";
import { AuthShell, Button, FieldError, Input, Label, Notice } from "@/components/ui/primitives";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  async function submit() {
    if (password.length < 10 || password.length > 256) {
      setMsg({ ok: false, text: "Password must be 10-256 characters." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (r.ok)
        setMsg({ ok: true, text: "Password reset successfully. You can now log in." });
      else setMsg({ ok: false, text: j.error || "Reset failed." });
    } catch {
      setMsg({ ok: false, text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Choose a new password between 10 and 256 characters using the secure token from your email."
      className="bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-bg)]"
    >
        {!token ? (
          <Notice
            title="This reset link cannot be used"
            variant="warning"
            role="alert"
            actions={<Button as="a" href="/forgot-password" variant="outline" size="sm">Request a new link</Button>}
          >
            The link is missing its secure token. Request a new password-reset email and use the latest link.
          </Notice>
        ) : msg?.ok ? (
          <Notice
            title="Password updated"
            variant="success"
            role="status"
            actions={<Button as="a" href="/login" size="sm">Go to login</Button>}
          >
            {msg.text}
          </Notice>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Label htmlFor="reset-password">New password (10-256 characters)</Label>
            <Input
              id="reset-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
            <Button type="submit" fullWidth className="mt-4" isLoading={busy}>
              Reset password
            </Button>
            {msg && <FieldError>{msg.text}</FieldError>}
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <a
            href="/login"
            className="font-semibold text-[var(--color-primary)] hover:underline"
          >
            ← Back to login
          </a>
        </p>
    </AuthShell>
  );
}
