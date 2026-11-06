"use client";

import { useEffect, useState } from "react";
// Fallback only. The live number comes from the published offer version in the
// database, which is what /api/student/offer returns.
import { DEFAULT_FREE_MONTHLY_LIMIT, DEFAULT_STUDENT_MONTHLY_LIMIT } from "@/lib/limits";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, X } from "@/app/icons";
import { Button, Notice } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import { useSession } from "@/app/session-context";

type OfferSummary = {
  publicName: string;
  publicSummary: string;
  callToAction: string;
  grantDays: number;
  tailoredResumesPerMonth: number;
  tokenTtlHours: number;
};

type Status = {
  enabled: boolean;
  eligible: boolean;
  pending: boolean;
  claimed: boolean;
  activeStudent: boolean;
  studentEmail: string | null;
  premiumUntil: string | null;
  offer: OfferSummary;
  claimedOfferVersion: number | null;
};

const ERRORS: Record<string, string> = {
  not_academic:
    "That doesn't look like a student email. Use your university address (.edu, .ac.uk, .edu.in, or a recognized university like utoronto.ca / tum.de / ethz.ch). School domain not recognized? Contact support for manual student verification.",
  email_claimed: "This student email has already been used for the offer.",
  already_active: "You've already claimed the offer with this email.",
  account_already_claimed: "This account has already used the student offer.",
  email_send_failed: "We couldn't send the email. Try again in a minute.",
  too_many_attempts:
    "Too many attempts from this account today. Please wait 24 hours or contact support.",
};

function StatusBanner({
  variant,
  children,
}: {
  variant: "success" | "error";
  children: React.ReactNode;
}) {
  const styles =
    variant === "success"
      ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/20"
      : "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]/20";
  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg border text-sm font-semibold mb-4 ${styles}`}
    >
      {variant === "success" ? <Check size={16} className="mt-0.5 shrink-0" /> : <X size={16} className="mt-0.5 shrink-0" />}
      {children}
    </div>
  );
}

export default function StudentOfferCard() {
  const { session, loading: sessionLoading } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [err, setErr] = useState("");
  // Settled (status loaded, logged-out detected, or the check failed):
  // anything but "still unknown" lets the card render — the skeleton must
  // never trap a user whose status endpoint errored.
  const [statusKnown, setStatusKnown] = useState(false);

  const searchParams = useSearchParams();
  const pathname = usePathname() || "/pricing";
  const studentStatus = searchParams?.get("student");
  const offer = status?.offer;

  useEffect(() => {
    if (sessionLoading) return;
    if (!session?.loggedIn) {
      setLoggedOut(true);
      setStatusKnown(true);
      return;
    }
    setLoggedOut(false);
    // A signed-in user should not face an empty input and a disabled-looking
    // button: pre-fill their account email so one click sends the link (the
    // API still requires an academic domain, same as typing it by hand).
    setEmail((current) => current || session.email || "");
    // A silently dropped status meant an already-verified student was shown the
    // claim form again, with no hint that the check had failed rather than come
    // back empty. Say so instead: the form still works, but the user is told
    // why it might be showing them a step they have already completed.
    fetch("/api/student/status")
      .then(async (r) => {
        if (r.status === 401) {
          setLoggedOut(true);
          setStatusKnown(true);
          return;
        }
        if (!r.ok) throw new Error(`status_${r.status}`);
        setStatus(await r.json());
        setStatusKnown(true);
      })
      .catch(() => {
        setErr("Your student status could not be checked just now. Nothing was changed — reload to try again.");
        setStatusKnown(true);
      });
  }, [session?.loggedIn, session?.email, sessionLoading]);

  async function send() {
    if (busy || !email.trim()) return;
    setBusy(true);
    setErr("");
    setSent("");
    try {
      const r = await fetch("/api/student/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentEmail: email.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(ERRORS[j.error] || "Something went wrong. Try again.");
        return;
      }
      setSent(j.sentTo);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // CLS guard: while the session or the /api/student/status check is in
  // flight, render the same-height skeleton instead of flashing the claim
  // form (which swaps for a logged-in user's active/claimed state a beat
  // later — a full form appears and vanishes on every load).
  if (sessionLoading || (!statusKnown && !status)) {
    return <Skeleton variant="card" height="14rem" />;
  }

  return (
    <div
      className="rounded-[var(--radius-xl)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] p-6 md:p-8 shadow-[var(--shadow-md)]"
    >
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white mb-4">
        Student offer
      </span>
      <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
        {offer?.publicSummary ?? "Student Premium for verified students."}
      </h2>

      {studentStatus === "activated" && (
        <StatusBanner variant="success">
          {offer?.publicName ?? "Student Premium"} activated.
        </StatusBanner>
      )}
      {studentStatus === "claimed" && (
        <StatusBanner variant="success">
          This student email has already been used for the offer.
        </StatusBanner>
      )}
      {studentStatus === "expired" && (
        <StatusBanner variant="error">
          That verification link has expired. Request a new one below.
        </StatusBanner>
      )}
      {studentStatus === "invalid" && (
        <StatusBanner variant="error">
          That verification link is invalid. Request a new one below.
        </StatusBanner>
      )}

      {status?.enabled === false && !status?.activeStudent ? (
        <Notice variant="neutral">
          <strong>Student Premium applications are currently closed.</strong> New enrollments
          for the student program are paused. If you already verified your student email, your
          access stays active until your renewal date. In the meantime, the free tools stay
          free: <a href="/pricing">see what Premium includes</a> if you want more.
        </Notice>
      ) : status?.activeStudent ? (
        <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          <strong className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            Active.
          </strong>{" "}
          Your student Premium runs until{" "}
          <strong>
            {status.premiumUntil
              ? new Date(status.premiumUntil).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—"}
          </strong>
          {status.studentEmail ? <> (verified via {status.studentEmail})</> : null}
          .
        </p>
      ) : status?.claimed ? (
        <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Your student Premium has ended. You&apos;re on the free plan — still{" "}
          {DEFAULT_FREE_MONTHLY_LIMIT} tailored {DEFAULT_FREE_MONTHLY_LIMIT === 1 ? "resume" : "resumes"} a
          month, the checker, and the manual maker, plus any credits you earned.{" "}
          <a href="/pricing" className="font-bold">
            Continue with a Premium pass
          </a>
          .
        </p>
      ) : sent ? (
        <>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            <strong className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Check your inbox.
            </strong>{" "}
            We sent a confirmation link to <strong>{sent}</strong>. Click it within{" "}
            {offer?.tokenTtlHours ?? 24} hours and Premium activates instantly.
          </p>
          {/* Typos happen: the sent state used to be a dead end until a page
              refresh. One click returns to the form with the field pre-filled
              so only the wrong character needs fixing. */}
          <Button variant="ghost" size="compact" className="mt-3" onClick={() => setSent("")}>
            Mistake in email? Enter another address
          </Button>
        </>
      ) : loggedOut ? (
        <>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-6">
            Verify your university email once — <strong>.edu, .ac.uk, .edu.in</strong> and recognized universities worldwide (utoronto.ca, tum.de, ethz.ch, ...) — and claim {offer?.publicSummary ?? "the current Student Premium offer"}: {offer?.tailoredResumesPerMonth ?? DEFAULT_STUDENT_MONTHLY_LIMIT} tailored resumes a month with the included
            premium features.
          </p>
          {/* Return the user to the surface they started from — /students#claim
              when mounted there, /pricing#student otherwise — instead of a
              hardcoded pricing anchor from every placement. */}
          <Button as="a" href={`/login?next=${encodeURIComponent(`${pathname}${pathname === "/students" ? "#claim" : "#student"}`)}`}>
            Log in to claim it
          </Button>
        </>
      ) : (
        <>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-6">
            Verify your university email once — <strong>.edu, .ac.uk, .edu.in</strong> and recognized universities worldwide (utoronto.ca, tum.de, ethz.ch, ...) — and claim {offer?.publicSummary ?? "the current Student Premium offer"}: {offer?.tailoredResumesPerMonth ?? DEFAULT_STUDENT_MONTHLY_LIMIT} tailored resumes a month with the included
            premium features.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              aria-label="Student email"
              className="flex-1 min-h-[46px] px-4 rounded-[var(--radius)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] text-[var(--color-text)] dark:text-[var(--color-dark-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <Button
              onClick={send}
              disabled={busy || !email.trim()}
              isLoading={busy}
            >
              {status?.pending && !busy
                ? "Resend link"
                : "Send verification link"}
            </Button>
          </div>
          {status?.pending && !sent && (
            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mt-2">
              A link is already on its way — check spam, or resend above.
            </p>
          )}
          {!email.trim() && (
            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mt-2">
              Enter your university email above to enable the button. This verifies your student status — it is
              separate from your account email verification.
            </p>
          )}
          {err && (
            <p
              className="text-sm text-[var(--color-danger)] mt-2"
              role="alert"
            >
              {err}
            </p>
          )}
          <p className="text-xs text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)] mt-4">
            One claim per student email, ever. No card required. After the {offer?.grantDays ?? 180}-day grant
            you drop back to the free plan automatically.
          </p>
        </>
      )}
    </div>
  );
}
