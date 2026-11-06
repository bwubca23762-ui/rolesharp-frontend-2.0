"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles, X } from "./icons";
import { Button } from "@/components/ui/primitives";
import { trackProductEvent } from "./product-analytics";
// Not @/lib/env: this is a client component and lib/env.ts parses process.env
// at module scope. lib/limits.ts holds the same defaults with no process access.
import { DEFAULT_FREE_MONTHLY_LIMIT, DEFAULT_PREMIUM_MONTHLY_LIMIT, tailoredResumes } from "@/lib/limits";

const FREE = [
  `${DEFAULT_FREE_MONTHLY_LIMIT} tailored ${DEFAULT_FREE_MONTHLY_LIMIT === 1 ? "resume" : "resumes"} / month`,
  "AI-tailored to the job",
  "Basic template",
  "PDF download (watermarked)",
  "Invite friends to earn credits",
];
const FREE_NO = [
  "Premium templates",
  "Cover letter & interview prep",
  "DOCX & LinkedIn export",
];
const PREM = [
  `${tailoredResumes(DEFAULT_PREMIUM_MONTHLY_LIMIT)} / month`,
  "Best-quality AI writing",
  "All templates, no watermark",
  "Cover letter in 3 tones + interview prep",
  "Recruiter deep-read report",
  "DOCX & LinkedIn export",
];
// Built but switched off in production: deploy.sh refuses to deploy unless
// JOBS_WORKFLOWS_ENABLED=false. Listed separately, without a checkmark, so the
// pass is never sold as if these were included today.
const PREM_SOON = [
  "Auto Apply — application email you approve first",
  "Daily Matches — job suggestions in your inbox",
];

export default function PricingToggle({
  monthlyPrice = 12,
  yearlyPrice = 79,
  monthlyDays = 30,
  yearlyDays = 365,
}: {
  monthlyPrice?: number;
  yearlyPrice?: number;
  monthlyDays?: number;
  yearlyDays?: number;
}) {
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoValidated, setPromoValidated] = useState(false);
  // The promo field is meaningless to a logged-out visitor: checkout requires
  // login first (the create-invoice call 401s and redirects), so the code
  // would be validated, then dropped. Only show it once a session exists.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { loggedIn: false }))
      .then((j) => setLoggedIn(Boolean(j?.loggedIn)))
      .catch(() => setLoggedIn(false));
  }, []);
  const price = yearly ? yearlyPrice : monthlyPrice;
  const accessDays = yearly ? yearlyDays : monthlyDays;
  const termDescription = yearly
    ? `One payment for ${yearlyDays} days of Premium. The full access term is stated directly rather than converted into a monthly rate.`
    : `One payment for ${monthlyDays} days of Premium. Access ends automatically; there is no renewal charge.`;

  // Promo validation: server-side, plan-aware. The discount itself is applied
  // at invoice creation — the UI only confirms eligibility up front.
  async function validatePromo() {
    if (!promoCode.trim() || promoBusy) return;
    setPromoBusy(true);
    try {
      const r = await fetch(`/api/promo/validate?code=${encodeURIComponent(promoCode.trim())}&plan=${yearly ? "yearly" : "monthly"}`);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.valid) {
        setPromoValidated(true);
        setErr("");
      } else {
        setPromoValidated(false);
        setErr("That promo code isn't valid for this plan.");
      }
    } catch {
      setPromoValidated(false);
      setErr("Could not check that code right now.");
    } finally {
      setPromoBusy(false);
    }
  }

  async function goPremium() {
    if (busy) return;
    setBusy(true);
    setErr("");
    const plan = yearly ? "yearly" : "monthly";
    const checkoutPath = `/settings?tab=billing&plan=${plan}${promoCode.trim() ? `&promo=${encodeURIComponent(promoCode.trim())}` : ""}`;
    // The public pricing card used to send every buyer straight to crypto,
    // while Card/UPI was only discoverable several screens later. The billing
    // workspace is the single secure choice point for both providers.
    trackProductEvent("checkout_intent", { context: `pricing:${plan}`, authState: loggedIn ? "authenticated" : "anonymous" });
    window.location.href = checkoutPath;
  }

  const ToggleButton = ({
    active,
    children,
    onClick,
  }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
        active
          ? "bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]"
          : "text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-text)] dark:hover:text-[var(--color-dark-text)]"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div>
      <div className="flex justify-center mb-10">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)]"
          role="group"
          aria-label="Premium access term"
        >
          <ToggleButton active={!yearly} onClick={() => setYearly(false)}>
            {monthlyDays}-day pass — ${monthlyPrice} once
          </ToggleButton>
          <ToggleButton active={yearly} onClick={() => setYearly(true)}>
            {yearlyDays}-day pass — ${yearlyPrice} once
          </ToggleButton>
        </div>
      </div>

      <div className="grid md:grid-cols-2 max-w-[820px] mx-auto md:[&>*:last-child]:border-l md:[&>*:last-child]:border-l-[var(--hairline)]">
        <div className="relative flex flex-col p-7 md:px-10">
          <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Free
          </h2>
          <div className="mt-4 text-5xl font-extrabold! tracking-[-0.045em] text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            $0
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Enough to check your resume and ship a real, ready-to-send PDF.
          </p>
          <ul className="space-y-3 my-7">
            {FREE.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                <Check size={18} className="text-[var(--color-success)] shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
            {FREE_NO.map((f) => (
              <li
                key={f}
                className="flex items-start gap-3 text-sm text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]"
              >
                <X size={18} className="shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <Button as="a" href="/login" variant="outline" fullWidth className="mt-auto">
            Sign up free
          </Button>
        </div>

        <div className="relative flex flex-col p-7 md:px-10">
          {/* Premium emphasis by glow + scale, not a border box. */}
          <div aria-hidden="true" className="pointer-events-none absolute -inset-x-6 -inset-y-4 -z-10 edt-glow md:scale-[1.02]" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.16em] text-[var(--color-primary)] dark:text-[var(--color-dark-text)]">
              Premium
            </h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white">
              Best value
            </span>
          </div>
          <div className="mt-4 text-5xl font-extrabold! tracking-[-0.045em] text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            ${price}
            <span className="text-base font-medium text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] ml-1">
              once
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            {accessDays}-day Premium pass. {termDescription}
          </p>
          <p className="my-5 font-[family-name:var(--font-mono)] text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Never auto-renews. When the pass ends, your account returns to Free and your saved resumes remain.
          </p>
          <ul className="space-y-3 mb-7">
            {PREM.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                <Check size={18} className="text-[var(--color-secondary)] shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
            {PREM_SOON.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                <Sparkles size={18} className="shrink-0 mt-0.5 opacity-60" aria-hidden />
                <span>
                  {f}
                  <span className="ml-2 whitespace-nowrap rounded-full border border-[var(--color-border)] dark:border-[var(--color-dark-border)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                    Access by request
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Button onClick={goPremium} fullWidth isLoading={busy} className="mt-auto">
            Choose payment method
          </Button>
          <p className="mt-2 text-center text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Card or UPI in INR · Crypto in USD</p>
          {/* Promo code entry — signed-in users only. Logged-out visitors hit
              a login redirect at checkout anyway, so the field was noise. */}
          {loggedIn && (
            <div className="mt-4">
              {promoValidated ? (
                <p className="text-center text-sm font-semibold text-[var(--color-success)]">
                  ✓ Promo code <span className="font-mono">{promoCode.toUpperCase()}</span> will be applied at checkout.
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoValidated(false); }}
                    placeholder="Promo code (optional)"
                    maxLength={24}
                    aria-label="Promo code"
                    className="min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-mono uppercase tracking-wide text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
                  />
                  <Button variant="outline" size="compact" type="button" onClick={() => void validatePromo()} disabled={!promoCode.trim()} isLoading={promoBusy}>
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}
          {err && (
            <p
              className="mt-3 text-sm text-center text-[var(--color-danger)]"
              role="alert"
            >
              {err}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
