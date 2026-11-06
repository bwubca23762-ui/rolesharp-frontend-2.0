"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "@/app/icons";
import Skeleton from "@/components/ui/Skeleton";
import { useSession } from "@/app/session-context";
import type { NotificationItem } from "@/lib/notifications";
import { fetchNotificationSummary } from "@/lib/notification-summary";

// The bell lives inside the navbar as a member action, so it no longer floats
// over the top-right corner on a fixed layer above the Account menu. The
// full-width announcement banner stays in NotificationCenter (app-shell).
export default function NotificationBell() {
  const { session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const loadSummary = useCallback(async () => {
    if (!session?.loggedIn) return;
    const data = await fetchNotificationSummary();
    if (!data) return;
    setUnreadCount(Number(data.unreadCount ?? 0));
  }, [session?.loggedIn]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      // An unreachable or erroring API used to leave items=[] and fall through
      // to the "You're all caught up" branch, so an outage was indistinguishable
      // from having no notifications — the failure state read as the good news.
      const response = await fetch("/api/notifications?limit=8", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) { setFailed(true); return; }
      const data = await response.json().catch(() => null);
      if (!data) { setFailed(true); return; }
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setFailed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => {
    if (!open) return;
    void loadItems();
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    // Escape returns focus to the bell. This is a popover, not a modal, so it
    // deliberately does not trap focus — ARIA expects Tab to leave a non-modal
    // popover — but dismissing it must not strand the caret at the top of the
    // document, which is what leaving focus on the removed subtree did.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [loadItems, open]);

  async function changeState(id: string, action: "read" | "archive") {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id, action }),
    });
    if (!response.ok) return;
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      readAt: item.readAt ?? new Date().toISOString(),
      archivedAt: action === "archive" ? (item.archivedAt ?? new Date().toISOString()) : item.archivedAt,
    } : item).filter((item) => !item.archivedAt));
    await loadSummary();
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    });
    if (!response.ok) return;
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  if (!session?.loggedIn) return null;

  return (
    <div className="rs-notification-root rs-notification-inline" ref={root}>
      <button ref={trigger} type="button" className="rs-notification-trigger" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} aria-controls="notification-popover" onClick={() => setOpen((value) => !value)}>
        <Bell size={19} />
        {unreadCount > 0 && <span aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <section id="notification-popover" className="rs-notification-popover" aria-label="Recent notifications">
          <header>
            <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
            {unreadCount > 0
              ? <button type="button" className="font-semibold text-[var(--color-primary)]" onClick={() => void markAllRead()}>Mark all read</button>
              : <a href="/notifications">View all</a>}
          </header>
          {loading ? (
            <div className="px-5 py-2 grid gap-2" aria-busy="true">
              <Skeleton variant="table-row" />
              <Skeleton variant="table-row" />
              <Skeleton variant="table-row" />
            </div>
          ) : failed ? (
            <div className="px-5 py-4">
              <p className="text-sm font-bold text-[var(--color-text)]" role="alert">Notifications could not be loaded.</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Nothing was marked read or archived. Existing notices are unchanged.</p>
              <button type="button" className="mt-3 text-sm font-semibold text-[var(--color-primary)] hover:underline" onClick={() => void loadItems()}>Try again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-4">
              <p className="text-sm font-bold text-[var(--color-text)]">You&apos;re all caught up.</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Service, security, and product notices land here. Until then, get value out of the workspace:</p>
              <ul className="mt-3 grid gap-1.5 text-sm">
                <li><a className="font-semibold text-[var(--color-primary)] hover:underline" href="/build">Build your first tailored resume</a></li>
                <li><a className="font-semibold text-[var(--color-primary)] hover:underline" href="/checker">Check its ATS score</a></li>
                <li><a className="font-semibold text-[var(--color-primary)] hover:underline" href="/campaign-settings">Set up Daily Matches for your roles</a></li>
              </ul>
            </div>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className={item.readAt ? "is-read" : "is-unread"}>
                  <button type="button" onClick={() => void changeState(item.id, "read")}>
                    <strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.effectiveAt}>{new Date(item.effectiveAt).toLocaleDateString()}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <footer><a href="/settings?tab=notifications">Notification preferences</a></footer>
        </section>
      )}
    </div>
  );
}
