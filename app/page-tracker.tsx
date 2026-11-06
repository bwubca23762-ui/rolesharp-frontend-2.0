"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analyticsAllowed } from "@/lib/cookie-consent";

/**
 * Self-hosted page view tracker. Sends path + anonymous session ID to
 * /api/analytics on every navigation. Session ID is stored in sessionStorage
 * (per-tab, never persists, zero PII). Fails silently — analytics must never
 * block or crash the page.
 */
export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!analyticsAllowed()) return; // user declined measurement cookies
    try {
      let sid = sessionStorage.getItem("_rs_sid");
      if (!sid) {
        sid = crypto.randomUUID();
        sessionStorage.setItem("_rs_sid", sid);
      }
      const payload = JSON.stringify({ type: "page_view", path: pathname, sessionId: sid });
      // sendBeacon is non-blocking and survives page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/analytics", { method: "POST", body: payload, keepalive: true }).catch(() => {});
      }
    } catch {}
  }, [pathname]);

  return null;
}
