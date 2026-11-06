"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/app/session-context";
import { Badge, Button, Card, EmptyState, Input, Label, Notice, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";

type ApplicationPackage = {
  id: string; recipient_record: { email?: string; source?: string; disposition?: string;
    canonicalSourceUrl?: string; capturedAt?: string; employerDomainRelationship?: string; reasons?: string[];
    candidates?: { email: string; warnings?: string[]; instruction?: string }[] }; subject: string; body: string;
  status: string; fit_score: number; confidence_score: number; blockers: unknown[]; source_url: string;
};
type Attempt = {
  id: string; package_id: string; status: string; current_invocation_ordinal: number;
  provider: string; verified_sender: string; subject: string; recipient_record: { email?: string };
  selected_recipient: string; source_url: string; created_at: string;
};

const statusCopy: Record<string, string> = {
  provider_accepted: "Application email accepted by provider — delivery unverified",
  unknown: "Provider outcome unknown — do not resend automatically",
  needs_user: "Needs your attention",
  retryable: "Provider explicitly rejected the request — bounded retry pending",
  terminal_failed: "Email attempt ended without provider acceptance",
  blocked: "Blocked before the provider boundary",
  canceled: "Canceled before the provider boundary",
  queued: "Queued within your daily pace",
  reserved: "Final safety checks in progress",
  sending: "Provider call started — outcome pending",
};

export default function QueuePanel({ showAttempts = true, headingLevel = "h1" }: { showAttempts?: boolean; headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  const { session, loading: sessionLoading } = useSession();
  const loggedOut = !sessionLoading && !session?.loggedIn;
  const [packages, setPackages] = useState<ApplicationPackage[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, { subject: string; body: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (sessionLoading) return;
    if (!session?.loggedIn) {
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [packageResponse, attemptResponse] = await Promise.all([
        fetch("/api/application-packages", { cache: "no-store" }),
        fetch("/api/application-attempts", { cache: "no-store" }),
      ]);
      if (packageResponse.status === 401) { setError("Your session expired. Log in again before reviewing the queue."); return; }
      if (!packageResponse.ok || !attemptResponse.ok) throw new Error("queue_unavailable");
      setPackages((await packageResponse.json()).packages ?? []);
      setAttempts((await attemptResponse.json()).attempts ?? []);
      setError("");
    } catch {
      setError("The application queue is temporarily unavailable. No approval or provider call was made.");
    } finally { setLoading(false); }
  }, [session?.loggedIn, sessionLoading]);

  useEffect(() => { void load(); }, [load]);
  const review = useMemo(() => packages.filter((item) => item.status === "review_required"), [packages]);
  const blocked = useMemo(() => packages.filter((item) => ["blocked", "stale"].includes(item.status)), [packages]);

  function toggle(item: ApplicationPackage) {
    const id = item.id;
    const candidates = item.recipient_record.candidates ?? [];
    if (!selectedRecipients[id] && candidates.length === 1) {
      setSelectedRecipients((current) => ({ ...current, [id]: candidates[0]!.email }));
    }
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id)
      : current.length < 5 ? [...current, id] : current);
  }

  async function approve() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/application-packages/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvals: selected.map((packageId) => ({
          packageId, selectedRecipient: selectedRecipients[packageId],
        })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "approval_failed");
      setMessage(`${data.approved} package${data.approved === 1 ? "" : "s"} approved. Final policy checks still run immediately before any provider call.`);
      setSelected([]); await load();
    } catch {
      setError("Approval failed. The packages remain unapproved and no provider call was made.");
    } finally { setBusy(false); }
  }

  async function saveRevision(item: ApplicationPackage) {
    const revision = editing[item.id];
    if (!revision) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/application-packages/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(revision),
      });
      if (!response.ok) throw new Error("revision_failed");
      setMessage("A new immutable draft was created. Any earlier approval was invalidated.");
      setEditing((current) => { const next = { ...current }; delete next[item.id]; return next; });
      setSelected((current) => current.filter((id) => id !== item.id));
      await load();
    } catch {
      setError("The draft could not be revised. Its existing approval state was not changed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="desk-queue space-y-8">
      {headingLevel === "h1" ? (
        <PageHeader
          title="Application Queue"
          description="Review the exact recipient, subject, body, resume attachment identity, fit, and evidence confidence. Jobs requiring an ATS form stay manual."
          compact
        />
      ) : (
        <header>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">Email applications only</p>
          <Heading className="mt-2 text-3xl font-extrabold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Application Queue</Heading>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Review the exact recipient, subject, body, resume attachment identity, fit, and evidence confidence. Jobs requiring an ATS form stay manual.</p>
        </header>
      )}
      {loggedOut && (
        <Notice
          title="Your review queue appears here after matching"
          variant="neutral"
          actions={<Button as="a" href="/login?next=/application-queue" size="sm">Log in to review</Button>}
        >
          Sign in to review each posting-backed recipient, exact email, resume attachment, fit score, and evidence confidence before anything can be approved.
        </Notice>
      )}
      {error && <Notice variant="danger" role="alert">{error}</Notice>}
      {message && <Notice variant="success" role="status">{message}</Notice>}
      {loading ? (
        <div className="grid gap-3" aria-busy="true">
          <Skeleton variant="card" height="9rem" />
          <Skeleton variant="card" height="9rem" />
          <Skeleton variant="card" height="9rem" />
        </div>
      ) : loggedOut ? null : (
        <>
          <section aria-labelledby="review-heading" className="rs-stagger space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="review-heading" className="text-xl font-bold!">
                  Review required <span className="text-sm font-normal text-[var(--color-text-muted)]">({review.length})</span>
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Select up to five current packages for today&apos;s batch. Approval expires after 24 hours.</p>
              </div>
              <Button disabled={!selected.length || busy || selected.some((id) => !selectedRecipients[id])} onClick={approve} isLoading={busy}>
                {busy ? "Working…" : `Approve selected (${selected.length}/5)`}
              </Button>
            </div>
            {!review.length && (
              <EmptyState
                title="No packages waiting"
                description="Packages appear when your campaign matches a posting that accepts email applications. Set your target roles and connect a send-only mailbox to get started. Each package requires your approval."
                actions={
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button as="a" href="/campaign-settings" variant="primary" size="sm">Configure campaign</Button>
                    <Button as="a" href="/email-connection" variant="outline" size="sm">Connect mailbox</Button>
                    <Button as="a" href="/daily-matches" variant="ghost" size="sm">View matches</Button>
                  </div>
                }
              />
            )}
            {review.map((item, index) => {
              const draft = editing[item.id];
              const warnings = (item.recipient_record.candidates ?? []).flatMap((candidate) => candidate.warnings ?? []);
              return (
                <Card key={item.id} as="article" style={{ "--rs-stagger-i": index } as React.CSSProperties} padding="md">
                  <div className="flex items-start gap-3">
                    <input aria-label={`Select application to ${item.recipient_record.email ?? "recipient"}`} type="checkbox" className="mt-1 h-5 w-5" checked={selected.includes(item.id)} onChange={() => toggle(item)} />
                    <div className="min-w-0 flex-1">
                      {/* DESIGN.md §5 queue row: job/company, then the score PAIR —
                          fit and confidence are separate terms and must not read
                          as one number. Row at wide widths, stacked at narrow. */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-bold! min-w-0 break-words">{item.subject}</h3>
                        <Badge variant="primary">Fit {item.fit_score} — confidence {item.confidence_score}</Badge>
                      </div>
                      {(item.recipient_record.candidates ?? []).length > 1 ? (
                        <div className="mt-3">
                          <Label htmlFor={`recipient-${item.id}`}>Posting-backed recipient</Label>
                          <Select
                            id={`recipient-${item.id}`}
                            value={selectedRecipients[item.id] ?? ""}
                            onChange={(event) => setSelectedRecipients((current) => ({ ...current, [item.id]: event.target.value }))}
                          >
                            <option value="">Choose one address from the posting</option>
                            {item.recipient_record.candidates!.map((candidate) => (
                              <option key={candidate.email} value={candidate.email}>{candidate.email}</option>
                            ))}
                          </Select>
                        </div>
                      ) : (
                        <p className="mt-2 break-all text-sm"><strong>Posting-backed recipient:</strong> {item.recipient_record.candidates?.[0]?.email ?? item.recipient_record.email}</p>
                      )}
                      {warnings.length > 0 && (
                        <Notice variant="warning" className="mt-3">
                          Review warning: {warnings.join(", ").replaceAll("_", " ")}.
                        </Notice>
                      )}
                      <div className="mt-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs leading-5 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]">
                        <p><strong>Recipient evidence:</strong> Explicit email-application instruction in the stored posting.</p>
                        <p><strong>Employer domain:</strong> {item.recipient_record.employerDomainRelationship ?? "unavailable"}</p>
                        {item.recipient_record.candidates?.[0]?.instruction && <blockquote className="mt-2 border-l-2 border-[var(--color-primary)] pl-2">{item.recipient_record.candidates[0].instruction}</blockquote>}
                        <p className="mt-2">Captured {item.recipient_record.capturedAt ? new Date(item.recipient_record.capturedAt).toLocaleString() : "with the job snapshot"}. Package changes invalidate approval.</p>
                      </div>
                      <details className="mt-4">
                        <summary className="cursor-pointer font-semibold">Preview and edit exact email</summary>
                        <div className="mt-3 grid gap-4">
                          <div>
                            <Label htmlFor={`subject-${item.id}`}>Subject</Label>
                            <Input
                              id={`subject-${item.id}`}
                              value={draft?.subject ?? item.subject}
                              onChange={(event) => setEditing((current) => ({ ...current, [item.id]: { subject: event.target.value, body: draft?.body ?? item.body } }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`body-${item.id}`}>Body</Label>
                            <Textarea
                              id={`body-${item.id}`}
                              rows={10}
                              value={draft?.body ?? item.body}
                              onChange={(event) => setEditing((current) => ({ ...current, [item.id]: { subject: draft?.subject ?? item.subject, body: event.target.value } }))}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" disabled={!draft || busy} isLoading={busy} onClick={() => saveRevision(item)}>Save as new draft</Button>
                            <Button as="a" variant="outline" href={item.source_url} target="_blank" rel="noopener noreferrer">Official application link</Button>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>

          {blocked.length > 0 && (
            <section aria-labelledby="blocked-heading">
              <h2 id="blocked-heading" className="text-xl font-bold!">Blocked or stale</h2>
              <div className="mt-3 grid gap-3">
                {blocked.map((item) => (
                  <Notice key={item.id} variant="warning" title={item.subject}>
                    <p>Automation is unavailable. Review the official link and apply manually if appropriate.</p>
                    <a className="mt-2 inline-block font-bold underline" href={item.source_url}>Open official link</a>
                  </Notice>
                ))}
              </div>
            </section>
          )}

          {showAttempts && (
            <section aria-labelledby="attempt-heading">
              <h2 id="attempt-heading" className="text-xl font-bold!">Attempt timeline</h2>
              <div className="mt-3 space-y-3">
                {attempts.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No email attempts yet.</p> : attempts.map((attempt) => (
                  <Card key={attempt.id} as="article" variant="outline" padding="sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold! break-words">{attempt.subject}</h3>
                        <p className="mt-1 break-all text-sm">{attempt.verified_sender} → {attempt.selected_recipient}</p>
                      </div>
                      <Badge variant="neutral">{attempt.status.replaceAll("_", " ")}</Badge>
                    </div>
                    {/* statusCopy is claim-integrity wording, not copy: provider
                        success stays "accepted by provider — delivery unverified"
                        and `unknown` deliberately offers no resend action. */}
                    <p className="mt-3 text-sm font-semibold">{statusCopy[attempt.status] ?? "State recorded in the durable application ledger"}</p>
                    {attempt.status === "unknown" && (
                      <p className="mt-2 text-sm text-[var(--color-warning-ink,#92400E)] dark:text-amber-200">
                        Check your provider’s Sent folder and contact the employer if necessary. RoleSharp intentionally provides no resend action for an unknown outcome.
                      </p>
                    )}
                    <a className="mt-2 inline-block text-sm font-bold text-[var(--color-primary)]" href={attempt.source_url}>Official application link</a>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
