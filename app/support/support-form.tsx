"use client";
import { useState } from "react";
import { Button, Card, Input, Label, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { Check } from "../icons";

export default function SupportForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const { toast } = useToast();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || "Couldn't send. Try again in a moment.");
        return;
      }
      setSent(true);
      toast("Message sent — we'll reply to your email.", "success");
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status">
        <Card variant="elevated" className="text-center py-12 px-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
            <Check size={28} />
          </div>
          <h3 className="text-xl font-bold font-[family-name:var(--font-display)] text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">
            Message received
          </h3>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-md mx-auto mb-6">
            The request is in the support queue. We&rsquo;ll reply to the email supplied, and signed-in requests remain available in support history.
          </p>
          <Button variant="outline" onClick={() => setSent(false)}>
            Send another
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="email">
          Email <span className="text-[var(--color-danger)]">*</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          maxLength={80}
        />
      </div>
      <div>
        <Label htmlFor="subject">
          Subject <span className="text-[var(--color-danger)]">*</span>
        </Label>
        <Input
          id="subject"
          name="subject"
          type="text"
          placeholder="Billing issue, login trouble, a bug..."
          required
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="message">
          What happened? <span className="text-[var(--color-danger)]">*</span>
        </Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Tell us what went wrong. If it&rsquo;s about billing or your account, mention the email you signed up with."
          required
          maxLength={4000}
        />
      </div>
      {/* honeypot */}
      <input
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] w-px h-px opacity-0 pointer-events-none"
      />
      {err && (
        <p className="text-sm font-semibold text-[var(--color-danger)]" role="alert">
          {err}
        </p>
      )}
      <Button type="submit" disabled={busy} isLoading={busy} fullWidth>
        {busy ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
