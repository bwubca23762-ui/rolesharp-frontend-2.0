"use client";
import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui/primitives";
import { ChevronRight } from "../icons";
import Skeleton from "@/components/ui/Skeleton";
import { useSession } from "../session-context";

type TicketSummary = {
  id: string;
  subject: string;
  status: string;
  last_actor: string;
  message_count: number;
  created_at: string;
};

export default function MyTickets() {
  const { session: me } = useSession();
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);

  useEffect(() => {
    if (!me || !me.loggedIn) return;
    fetch("/api/support")
      .then((r) => (r.ok ? r.json() : { tickets: [] }))
      .then((j) => setTickets(j.tickets || []))
      .catch(() => setTickets([]));
  }, [me]);

  if (!me) {
    return (
      <Card padding="md" className="text-center">
        <Skeleton variant="text" count={3} className="mx-auto" />
      </Card>
    );
  }
  if (!me.loggedIn) return null;
  if (!tickets) {
    return (
      <Card padding="md" className="text-center">
        <Skeleton variant="text" count={3} className="mx-auto" />
      </Card>
    );
  }
  if (!tickets.length) return null;

  return (
    <Card padding="md">
      <h3 className="text-lg font-bold font-[family-name:var(--font-display)] text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
        Your support tickets
      </h3>
      <div className="flex flex-col gap-3">
        {tickets.map((t) => (
          <a
            key={t.id}
            href={`/support/${t.id}`}
            className="group flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] p-4 transition-all hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]"
          >
            <div className="min-w-0">
              <p className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)] truncate">
                {t.subject}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mt-0.5">
                {t.last_actor === "admin" ? "Reply from team" : "Awaiting reply"} — {t.message_count} message
                {t.message_count !== 1 ? "s" : ""} — {new Date(t.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={t.status === "open" ? "warning" : t.status === "answered" ? "info" : "success"}>{t.status}</Badge>
              <ChevronRight
                size={16}
                className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}
