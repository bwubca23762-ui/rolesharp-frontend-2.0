"use client";
import { useEffect, useState } from "react";
import { Button, Notice } from "@/components/ui/primitives";
import { Bell } from "../../icons";
import Skeleton from "@/components/ui/Skeleton";
import FeatureSection from "../feature-section";

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState({ productUpdatesEnabled: true, careerTipsEnabled: true });
  const [emailPreferences, setEmailPreferences] = useState({ productUpdates: false, careerTips: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPreferences() {
    setLoading(true);
    setLoadError("");
    setMessage("");
    try {
      const [notificationResponse, emailResponse] = await Promise.all([
        fetch("/api/notifications/preferences", { cache: "no-store" }),
        fetch("/api/communications/preferences", { cache: "no-store" }),
      ]);
      const notificationData = await notificationResponse.json().catch(() => null);
      const emailData = await emailResponse.json().catch(() => null);
      if (!notificationResponse.ok || !notificationData?.preferences || !emailResponse.ok || !emailData) {
        throw new Error("preferences_unavailable");
      }
      setPreferences(notificationData.preferences);
      setEmailPreferences(emailData);
    } catch {
      setLoadError("Notification preferences are temporarily unavailable. Your saved choices have not been changed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPreferences(); }, []);

  async function save() {
    setBusy(true); setMessage("");
    try {
      const [notificationResponse, emailResponse] = await Promise.all([
        fetch("/api/notifications/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preferences) }),
        fetch("/api/communications/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emailPreferences) }),
      ]);
      const notificationData = await notificationResponse.json().catch(() => null);
      const emailData = await emailResponse.json().catch(() => null);
      if (!notificationResponse.ok || !notificationData?.preferences || !emailResponse.ok || !emailData) {
        await loadPreferences();
        setMessage("One or more settings may have saved. We reloaded your saved choices; review them before trying again.");
        return;
      }
      setPreferences(notificationData.preferences); setEmailPreferences(emailData);
      setMessage("Notification and email preferences saved.");
    } catch {
      await loadPreferences();
      setMessage("The save did not finish cleanly. We reloaded your saved choices; review them before trying again.");
    }
    finally { setBusy(false); }
  }

  return (
    <FeatureSection icon={<Bell size={20} />} title="Notification preferences" description="Choose which product emails reach your inbox.">
      <Notice variant="neutral" className="mb-5">Essential service, security, account, and material legal notices cannot be disabled. Optional in-app and email communications are controlled separately and email starts opted out.</Notice>
        {loading ? (
          <div className="grid gap-3" aria-busy="true">
          <Skeleton variant="card" height="5rem" />
          <Skeleton variant="card" height="5rem" />
          <Skeleton variant="card" height="5rem" />
        </div>
        ) : loadError ? (
          <div role="alert">
            <p className="text-sm text-[var(--color-danger)]">{loadError}</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void loadPreferences()}>Retry</Button>
          </div>
        ) : (
        <div className="grid gap-4">
          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]"><span><strong className="block">Product updates</strong><small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">New RoleSharp capabilities and meaningful product changes.</small></span><input type="checkbox" checked={preferences.productUpdatesEnabled} onChange={(event) => setPreferences((value) => ({ ...value, productUpdatesEnabled: event.target.checked }))} /></label>
          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]"><span><strong className="block">Career guidance</strong><small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Optional job-search tips and career workflow suggestions.</small></span><input type="checkbox" checked={preferences.careerTipsEnabled} onChange={(event) => setPreferences((value) => ({ ...value, careerTipsEnabled: event.target.checked }))} /></label>
          <h4 className="mt-2 font-bold!">Optional email</h4>
          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]"><span><strong className="block">Product update email</strong><small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Explicit opt-in for occasional product announcements. Every message includes unsubscribe.</small></span><input type="checkbox" checked={emailPreferences.productUpdates} onChange={(event) => setEmailPreferences((value) => ({ ...value, productUpdates: event.target.checked }))} /></label>
          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]"><span><strong className="block">Career guidance email</strong><small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Explicit opt-in for optional career guidance. Daily Matches remains a separate workflow.</small></span><input type="checkbox" checked={emailPreferences.careerTips} onChange={(event) => setEmailPreferences((value) => ({ ...value, careerTips: event.target.checked }))} /></label>
          <div className="flex flex-wrap items-center gap-3"><Button onClick={save} disabled={busy || loading} isLoading={busy}>Save preferences</Button><Button as="a" href="/notifications" variant="outline">Notification history</Button>{message && <span role="status" className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{message}</span>}</div>
        </div>
      )}
    </FeatureSection>
  );
}
