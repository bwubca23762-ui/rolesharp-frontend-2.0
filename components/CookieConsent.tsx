"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { getCookieConsent, setCookieConsent, type CookieConsentChoice } from "@/lib/cookie-consent";

// First-visit cookie / storage notice. Hidden until mounted + no stored choice,
// so it never flashes for returning visitors or during SSR. Accept/Decline both
// persist; Decline stops the first-party analytics beacon via analyticsAllowed().
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  if (!visible) return null;

  function choose(choice: CookieConsentChoice) {
    setCookieConsent(choice);
    setVisible(false);
    // Bottom-slot coordination (REDESIGN-SPEC §3.10): pages with their own
    // bottom-fixed elements (the builder's sticky mobile generate bar) listen
    // for this so the slot hands over the moment a choice is made.
    window.dispatchEvent(new CustomEvent("rolesharp:cookie-consent"));
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie and privacy notice"
      className="fixed inset-x-0 bottom-0 z-[80] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_18px_50px_rgba(7,26,51,0.22)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            We use cookies &amp; storage
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            We use essential storage to keep you signed in and remember your theme, plus privacy-friendly,
            first-party analytics (a per-tab session ID, never sold or shared) to improve RoleSharp. Read our{" "}
            <a href="/privacy" className="font-semibold text-[var(--color-primary)] hover:underline">Privacy Policy</a>
            {" "}and{" "}
            <a href="/terms" className="font-semibold text-[var(--color-primary)] hover:underline">Terms</a>.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("declined")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
