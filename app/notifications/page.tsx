"use client";

import { useEffect, useState } from "react";
import AuthRequiredState from "@/components/AuthRequiredState";
import { Badge, Button, Card, EmptyState, WorkspaceShell } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import type { NotificationItem } from "@/lib/notifications";
import { useSession } from "../session-context";

export default function NotificationsPage() {
  const { session, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/notifications?limit=50&archived=1", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error("notification_history_unavailable");
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch { setError("Notification history is temporarily unavailable."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (session?.loggedIn) void load(); }, [session?.loggedIn]);

  async function update(item: NotificationItem, action: "read" | "archive") {
    if (updatingId !== null) return;
    setUpdatingId(item.id);
    try {
      const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: item.id, action }) });
      if (response.ok) await load();
    } finally {
      setUpdatingId(null);
    }
  }

  if (!sessionLoading && session && !session.loggedIn) return <AuthRequiredState title="Log in to view notifications" description="Your private service, account, legal, and product notices are available after sign-in." actionLabel="Continue to login" nextPath="/notifications" />;

  return (
    <WorkspaceShell eyebrow="Account" title="Notifications" description="Review account updates, security notices, and activity from your job search." actions={<Button as="a" href="/settings?tab=notifications" variant="outline">Preferences</Button>}>
      {loading || sessionLoading ? (
        <div className="grid gap-3" aria-busy="true">
          <Skeleton variant="card" height="7rem" />
          <Skeleton variant="card" height="7rem" />
          <Skeleton variant="card" height="7rem" />
        </div>
      ) : error ? <div role="alert"><Card className="p-6"><p>{error}</p><Button className="mt-4" onClick={load}>Retry</Button></Card></div> : items.length === 0 ? <EmptyState title="No notifications yet" description="Service, security, legal, and product notices will appear here. Nothing needs your attention right now." actions={<Button as="a" href="/settings?tab=notifications" variant="outline">Choose what you are notified about</Button>} /> : (
        <ul className="list-none divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {items.map((item) => (
            <li key={item.id} className="py-5">
              <article className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant={item.material ? "warning" : "default"}>{item.category}</Badge>
                    {!item.readAt && <span className="text-sm font-semibold text-[var(--fg)]">Unread</span>}
                    {item.archivedAt && <span className="text-sm text-[var(--muted-fg)]">Archived</span>}
                    <time className="text-sm tabular-nums text-[var(--muted-fg)]" dateTime={item.effectiveAt}>{new Date(item.effectiveAt).toLocaleString()}</time>
                  </div>
                  <h2 className="mt-2 break-words text-lg font-semibold!">{item.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[var(--muted-fg)]">{item.body}</p>
                  {item.ctaUrl && <Button className="mt-3" variant="outline" size="sm" as="a" href={item.ctaUrl}>{item.ctaLabel}</Button>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!item.readAt && <Button size="sm" variant="outline" isLoading={updatingId === item.id} onClick={() => void update(item, "read")}>Mark read</Button>}
                  {!item.archivedAt && <Button size="sm" variant="ghost" isLoading={updatingId === item.id} onClick={() => void update(item, "archive")}>Archive</Button>}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </WorkspaceShell>
  );
}
