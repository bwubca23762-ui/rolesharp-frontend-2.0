"use client";
import { useState } from "react";
import { Button, Card, Input, Label, Textarea } from "@/components/ui/primitives";

// Intro request form (Phase 4): the recruiter's ONLY way in — no identity is
// shown before the site owner chooses to respond. Stored as a pending
// request; the owner sees it in their settings and decides.

export default function TalentIntroForm({ siteId, headline }: { siteId: string; headline: string }) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/talent/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, contact, company, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Could not send the intro request.");
        return;
      }
      setNote("Request sent. They will see your contact only if they choose to respond.");
      setOpen(false);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (note) return <p className="m-0 text-sm font-semibold text-[var(--color-success)]" role="status">{note}</p>;

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Request an intro — {headline}
      </Button>
    );
  }

  return (
    <Card padding="sm" className="mt-2 p-4">
      <Label htmlFor={`intro-contact-${siteId}`}>Your work email or LinkedIn</Label>
      <Input id={`intro-contact-${siteId}`} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@company.com or linkedin.com/in/you" />
      <div className="mt-3">
        <Label htmlFor={`intro-company-${siteId}`}>Company</Label>
        <Input id={`intro-company-${siteId}`} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
      </div>
      <div className="mt-3">
        <Label htmlFor={`intro-message-${siteId}`}>The role and why them</Label>
        <Textarea id={`intro-message-${siteId}`} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="One or two sentences. This is the message they read." />
      </div>
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]" role="alert">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => void send()} disabled={busy || contact.trim().length < 5 || company.trim().length < 2 || message.trim().length < 10} isLoading={busy}>
          Send request
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );
}
