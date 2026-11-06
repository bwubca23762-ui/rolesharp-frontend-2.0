"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "@/app/icons";
import { useSession } from "@/app/session-context";
import type { NotificationItem } from "@/lib/notifications";
import { fetchNotificationSummary } from "@/lib/notification-summary";

// The full-width announcement banner. The bell + popover live in the navbar
// (NotificationBell); this component only renders a pinned announcement when
// one is published, so the two never fight over the top-right corner.
export default function NotificationCenter() {
  const { session } = useSession();
  const [banner, setBanner] = useState<NotificationItem | null>(null);

  const loadSummary = useCallback(async () => {
    if (!session?.loggedIn) return;
    const data = await fetchNotificationSummary();
    if (!data) return;
    setBanner(data.banner ?? null);
  }, [session?.loggedIn]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  async function dismiss(id: string) {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id, action: "dismiss" }),
    });
    if (!response.ok) return;
    if (banner?.id === id) setBanner(null);
  }

  if (!session?.loggedIn || !banner) return null;

  return (
    <section className={`rs-notification-banner is-${banner.severity}`} role={banner.severity === "critical" ? "alert" : "status"} aria-label="Important notification">
      <div><strong>{banner.title}</strong><span>{banner.body}</span>{banner.ctaUrl && <a href={banner.ctaUrl}>{banner.ctaLabel}</a>}</div>
      <button type="button" aria-label={`Dismiss ${banner.title}`} onClick={() => void dismiss(banner.id)}><X size={18} /></button>
    </section>
  );
}

