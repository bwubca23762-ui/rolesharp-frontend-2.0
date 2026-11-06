"use client";

// Cookie / storage consent state. The site's own analytics is first-party and
// session-scoped (no cross-site tracker, no persistent identifier), so consent
// here governs that measurement plus any future non-essential storage. The
// choice is mirrored into a real cookie (rs_consent) so the "we use cookies"
// notice reflects an actual stored value, and into localStorage so the banner
// does not re-ask on every visit.

export type CookieConsentChoice = "accepted" | "declined";

const STORAGE_KEY = "rs_cookie_consent";
const COOKIE_NAME = "rs_consent";
const CONSENT_COOKIE_DAYS = 180;

export const COOKIE_CONSENT_EVENT = "rs:cookie-consent";

export function getCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

function writeConsentCookie(choice: CookieConsentChoice) {
  try {
    const maxAge = CONSENT_COOKIE_DAYS * 24 * 60 * 60;
    document.cookie = `${COOKIE_NAME}=${choice}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch {
    // A cookie write must never break the banner.
  }
}

export function setCookieConsent(choice: CookieConsentChoice) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {}
  writeConsentCookie(choice);
  try {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: choice }));
  } catch {}
}

// Analytics runs unless the user has explicitly declined. Before any choice the
// banner is showing and measurement is anonymous/session-only, which the banner
// copy states plainly. Decline is a hard stop.
export function analyticsAllowed(): boolean {
  return getCookieConsent() !== "declined";
}

export function onCookieConsentChange(listener: (choice: CookieConsentChoice) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CookieConsentChoice>).detail;
    if (detail === "accepted" || detail === "declined") listener(detail);
  };
  window.addEventListener(COOKIE_CONSENT_EVENT, handler);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handler);
}
