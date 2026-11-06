"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui/primitives";
import { Check } from "@/app/icons";

// Dashboard activation checklist (gap report Tier B): the four steps map to
// the product's real loop — save → tailor → track — and every checkmark is
// derived from actual account state (server-side), never from clicking
// around the checklist. Completing all three actionable steps pays a
// one-time +1 credit, claimed explicitly so the moment is the user's.
type Status = {
  accountCreated: true;
  savedResume: boolean;
  tailoredToCompany: boolean;
  trackedApplication: boolean;
  bonusClaimed: boolean;
  complete: boolean;
};

const STEPS: Array<{ key: keyof Omit<Status, "accountCreated" | "complete" | "bonusClaimed">; label: string; detail: string; href: string; cta: string }> = [
  { key: "savedResume", label: "Save your first resume", detail: "Build it, import an old one, or tailor from a company page — it lands in your account.", href: "/build", cta: "Build a resume" },
  { key: "tailoredToCompany", label: "Tailor it to a real company", detail: "A version pointed at one named employer beats a generic resume on keywords and phrasing.", href: "/build", cta: "Pick a company" },
  { key: "trackedApplication", label: "Track the application", detail: "One board for every job you're chasing — stages, notes, follow-ups, and offers.", href: "/tracker", cta: "Open the tracker" },
];

export default function OnboardingChecklist() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/onboarding", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  // Hidden while loading and after the bonus is claimed — the card's job is
  // the activation moment, and a lingering completed checklist is clutter.
  if (!status || (status.complete && status.bonusClaimed)) return null;

  const done = (key: keyof Omit<Status, "accountCreated" | "complete" | "bonusClaimed">) => Boolean(status[key]);
  const allDone = status.complete;

  async function claim() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const response = await fetch("/api/onboarding", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || (!data.ok && !data.alreadyClaimed)) {
        setErr("Could not claim the bonus right now. Try again.");
        return;
      }
      setClaimed(true);
      setStatus({ ...status, bonusClaimed: true } as Status);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="md" className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-base font-bold! text-[var(--color-text)]">Getting started</h2>
        {allDone && !status.bonusClaimed && !claimed && <span className="text-xs font-bold text-[var(--color-primary)]">+1 credit waiting</span>}
        {(status.bonusClaimed || claimed) && <span className="text-xs text-[var(--color-text-muted)]">Bonus credit claimed — thank you.</span>}
      </div>
      <ol className="m-0 mt-3 list-none space-y-2 p-0">
        {STEPS.map((step) => {
          const isDone = done(step.key);
          return (
            <li key={step.key} className="flex items-start gap-3">
              <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${isDone ? "border-transparent bg-[var(--color-primary)] text-[var(--on-primary)]" : "border-[var(--color-border)] text-transparent"}`}>
                <Check size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`m-0 text-sm font-semibold ${isDone ? "text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] line-through" : "text-[var(--color-text)]"}`}>
                  {step.label}
                </p>
                {!isDone && <p className="m-0 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{step.detail} <a href={step.href} className="font-semibold text-[var(--color-primary)] hover:underline">{step.cta} →</a></p>}
              </div>
            </li>
          );
        })}
      </ol>
      {allDone && !status.bonusClaimed && !claimed && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="compact" onClick={() => void claim()} disabled={busy} isLoading={busy}>Claim +1 credit</Button>
          <p className="m-0 text-xs text-[var(--color-text-muted)]">One credit = one premium-feature unlock on any resume.</p>
        </div>
      )}
      {err && <p className="mt-2 mb-0 text-sm text-[var(--color-danger)]" role="alert">{err}</p>}
    </Card>
  );
}
