"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, Button, Badge, Label, Textarea, WorkspaceShell } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, MessageSquare } from "../../icons";

type Msg = { id: string; author: string; body: { toString(): string }; created_at: string };
type Ticket = { id: string; subject: string; status: string; email: string; messages: Msg[]; created_at: string };

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [err, setErr] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/support/${id}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || "Couldn't load ticket");
        return;
      }
      setTicket(j.ticket);
    } catch {
      setErr("Couldn't load ticket.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!reply.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/support/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(j.error || "Couldn't send reply.", "error");
        return;
      }
      setReply("");
      toast("Reply sent.", "success");
      load();
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (err) {
    return (
      <WorkspaceShell
        eyebrow="Support"
        title="Ticket unavailable"
        description="The ticket could not be loaded. No support message was changed."
        actions={<Button as="a" href="/support" variant="outline">Back to support</Button>}
      >
        <Card className="p-8 text-center">
          <div role="alert">
            <h2 className="text-2xl font-bold font-[family-name:var(--font-display)] text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">
              Ticket not found
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{err}</p>
          </div>
        </Card>
      </WorkspaceShell>
    );
  }

  if (!ticket) {
    return (
      <WorkspaceShell
        eyebrow="Support"
        title="Loading support ticket"
        description="Retrieving the conversation from your private support history."
      >
        <div className="flex items-center justify-center gap-3 py-12 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]" role="status" aria-live="polite">
          <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          Loading ticket…
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow="Support ticket"
      title={ticket.subject}
      description={`Opened ${new Date(ticket.created_at).toLocaleString()} — replies stay attached to this account conversation.`}
      actions={(
        <Button as="a" href="/support" variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />}>
          Back to support
        </Button>
      )}
      meta={<Badge variant={ticket.status === "open" ? "warning" : ticket.status === "answered" ? "info" : "success"}>{ticket.status}</Badge>}
    >
        <div className="flex flex-col gap-4 mb-8">
          {ticket.messages.map((m) => (
            <Card
              key={m.id}
              padding="md"
              className={
                m.author === "admin"
                  ? "border-l-4 border-l-[var(--color-primary)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)]"
                  : "bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)]"
              }
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant={m.author === "admin" ? "primary" : "outline"}>
                  <MessageSquare size={12} />
                  {m.author === "admin" ? "RoleSharp" : "You"}
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-sm leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)] whitespace-pre-wrap">
                {String(m.body)}
              </div>
            </Card>
          ))}
        </div>

        {ticket.status !== "resolved" && (
          <Card padding="md">
            <h3 className="text-lg font-bold font-[family-name:var(--font-display)] text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              Add a reply
            </h3>
            <div className="mb-4">
              <Label htmlFor="reply">Message</Label>
              <Textarea
                id="reply"
                rows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Add more details, or ask for a progress update."
                maxLength={4000}
              />
            </div>
            <Button onClick={send} disabled={busy || !reply.trim()} isLoading={busy}>
              {busy ? "Sending..." : "Reply"}
            </Button>
          </Card>
        )}
    </WorkspaceShell>
  );
}
