"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, GeneratedOutput, Notice } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";

// Follow-up drafts (Phase 5): quiet applications — applied, no movement for
// ten days — surface here with a ready-to-copy draft built only from what the
// candidate actually submitted. The panel never sends anything: Copy hands
// the text to the candidate's own mailbox, and "Mark as sent" records the
// nudge so the SQL cap (max two, seven days apart) holds.

type FollowupDraft = {
  applicationId: string;
  company: string;
  role: string;
  followUpCount: number;
  subject: string;
  body: string;
  citedBullet: string | null;
};

export default function FollowupsPanel() {
  const [drafts, setDrafts] = useState<FollowupDraft[] | null>(null);
  const [error, setError] = useState("");
  const [markedId, setMarkedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/followups");
      if (res.status === 401) return;
      if (!res.ok) throw new Error();
      const data = await res.json() as { drafts: FollowupDraft[] };
      setDrafts(data.drafts);
    } catch {
      setError("Could not load follow-up drafts. Try again in a moment.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markSent(applicationId: string) {
    setError("");
    try {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!res.ok) throw new Error();
      setMarkedId(applicationId);
      await load();
    } catch {
      setError("Could not record the follow-up. Try again in a moment.");
    } finally {
      setTimeout(() => setMarkedId(null), 2500);
    }
  }

  if (drafts === null && !error) {
    return <div className="mt-6"><Skeleton variant="card" height="120px" /></div>;
  }
  if (!drafts?.length) return null;

  return (
    <section aria-label="Follow-up drafts" className="mt-6">
      <Notice variant="info" title={`Quiet applications — ${drafts.length} draft${drafts.length === 1 ? "" : "s"} ready`} role="status">
        Applied with no movement for 10+ days. Drafts use only what your application already said — nothing invented.
        At most two follow-ups per application, seven days apart — most replies that ever come, come on the second try, and a third nudge reads as pressure. We stop at two so you never send it.
      </Notice>
      {error && <Notice variant="danger" role="alert" className="mt-3">{error}</Notice>}
      <div className="mt-3 grid gap-3">
        {drafts.map((draft) => (
          <div key={draft.applicationId} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">{draft.role} — {draft.company}</strong>
              <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                follow-up {draft.followUpCount + 1} of 2
              </span>
            </div>
            <GeneratedOutput
              label={`Follow-up ${draft.followUpCount + 1} of 2`}
              text={`Subject: ${draft.subject}\n\n${draft.body}`}
              actions={
                <Button size="sm" variant="ghost" onClick={() => void markSent(draft.applicationId)}>
                  {markedId === draft.applicationId ? "Recorded" : "I sent it"}
                </Button>
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
