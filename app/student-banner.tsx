"use client";

import { useEffect, useState } from "react";
import { X, GraduationCap } from "./icons";

const KEY = "rs-student-banner-dismissed";
const RETURN_AFTER_DAYS = 14;

export default function StudentBanner({ enabled = true }: { enabled?: boolean }) {
  // Start visible so the banner occupies its slot in the first (SSR) paint —
  // hiding it post-hydration only for recently-dismissed users avoids pushing
  // the hero down (CLS) for everyone else.
  const [show, setShow] = useState(true);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(KEY) || 0);
      if (at && Date.now() - at <= RETURN_AFTER_DAYS * 86400e3) setShow(false);
    } catch {}
  }, []);

  // Kill switch (migration 065): the offer is closed for new claims, so the
  // landing banner must not advertise it. Early-return AFTER the constants —
  // the dismissal window and storage keys stay part of the contract for when
  // the program reopens.
  if (!enabled) return null;

  if (!show) return null;

  return (
    <div
      className="rs-student-banner"
      role="region"
      aria-label="Student offer"
    >
      <div className="rs-student-banner-inner">
        <a href="/students" className="rs-student-offer" aria-label="Claim six free months of RoleSharp Premium">
          <span className="rs-student-offer-badge">
            <GraduationCap size={16} aria-hidden="true" />
            <span>Student edition</span>
          </span>

          <span className="rs-student-offer-copy">
            <strong>Six months of Premium. Free.</strong>
            <span className="rs-student-offer-proof" aria-hidden="true">
              University email
              <i />
              No card
              <i />
              Nothing to cancel
            </span>
          </span>

          <span className="rs-student-offer-mobile">
            Students get <strong>6 months free</strong>
          </span>

          <span className="rs-student-offer-cta">
            <span className="hidden sm:inline">Claim student access</span>
            <span className="sm:hidden">Claim</span>
            <span aria-hidden="true">→</span>
          </span>
        </a>

        <div className="rs-student-banner-close">
          <button
            type="button"
            aria-label="Dismiss student offer banner"
            onClick={() => {
              setShow(false);
              try {
                localStorage.setItem(KEY, String(Date.now()));
              } catch {}
            }}
            className="rs-student-dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
