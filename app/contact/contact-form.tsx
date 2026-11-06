"use client";
import { useState } from "react";
import { Button } from "@/components/ui/primitives/Button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/primitives/Form";

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setState("sending");
    setError("");
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState("error");
        setError(j.error || "Could not send. Please try again.");
        return;
      }
      setState("sent");
      form.reset();
    } catch {
      setState("error");
      setError("Network error. Please try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="text-center p-8 rounded-[var(--radius-lg)] bg-[var(--color-success-bg)] dark:bg-[var(--color-success)]/10 border border-[var(--color-success)]/20" role="status">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--color-success)] text-white flex items-center justify-center text-2xl font-bold">✓</div>
        <h3 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">Message sent</h3>
        <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-6">Thanks — we&rsquo;ll reply to your email as soon as we can.</p>
        <Button variant="outline" onClick={() => setState("idle")}>Send another</Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" name="name" type="text" autoComplete="name" placeholder="Your name" maxLength={120} />
        </div>
        <div>
          <Label htmlFor="contact-email">Email <span className="text-[var(--color-danger)]">*</span></Label>
          <Input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={200} />
        </div>
      </div>
      <div>
        <Label htmlFor="contact-subject">Subject</Label>
        <Input id="contact-subject" name="subject" type="text" placeholder="Billing, account access, a bug..." maxLength={160} />
      </div>
      <div>
        <Label htmlFor="contact-message">Message <span className="text-[var(--color-danger)]">*</span></Label>
        <Textarea id="contact-message" name="message" rows={5} placeholder="Tell us what happened. Include your account email if it&rsquo;s about billing or access." required maxLength={4000} />
      </div>
      {/* Honeypot — hidden from real users */}
      <input name="company" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="lg" isLoading={state === "sending"} className="w-full sm:w-auto">
        Send message
      </Button>
    </form>
  );
}
