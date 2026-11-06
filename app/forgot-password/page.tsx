"use client";

import { useState } from "react";
import { AuthShell, Button, FieldError, Input, Label, Notice } from "@/components/ui/primitives";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!email) {
      setErr("Enter your email.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) setSent(true);
      else setErr("Could not send reset email.");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Forgot your password?"
      description="Request a secure reset link without revealing whether an email address has an account."
      className="bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-bg)]"
    >
        {sent ? (
          <Notice
            title="Check your inbox"
            variant="success"
            role="status"
            actions={<Button as="a" href="/login" variant="outline" size="sm">Return to login</Button>}
          >
            If an account with that email exists, we&apos;ve sent a reset link. The link expires after one hour.
          </Notice>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p className="mb-6 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Enter the email you signed up with and we&apos;ll send you a reset link.
            </p>
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            <Button type="submit" fullWidth className="mt-4" isLoading={busy}>
              Send reset link
            </Button>
            {err && <FieldError>{err}</FieldError>}
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
