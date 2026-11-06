"use client";

import {
  deviceClassForWidth,
  normalizeAnalyticsPath,
  pageFamilyForPath,
  sanitizeAnalyticsContext,
  type ProductAnalyticsEvent,
  type ProductAuthState,
  type ProductEventName,
} from "@/lib/product-analytics";
import { analyticsAllowed } from "@/lib/cookie-consent";

const SESSION_KEY = "_rs_sid";

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function deliver(payload: ProductAnalyticsEvent) {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    return;
  }
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function trackProductEvent(
  event: ProductEventName,
  options: { context?: string; authState?: ProductAuthState; path?: string } = {},
) {
  if (typeof window === "undefined") return;
  if (!analyticsAllowed()) return; // user declined measurement cookies
  try {
    const path = normalizeAnalyticsPath(options.path ?? window.location.pathname);
    if (!path) return;
    const context = sanitizeAnalyticsContext(options.context);
    deliver({
      type: "event",
      event,
      path,
      pageFamily: pageFamilyForPath(path),
      deviceClass: deviceClassForWidth(window.innerWidth),
      authState: options.authState ?? "unknown",
      sessionId: sessionId(),
      ...(context ? { context } : {}),
    });
  } catch {
    // Measurement must never interrupt product work.
  }
}
