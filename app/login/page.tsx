"use client";

import { useEffect, useState } from "react";
import { AuthShell, Button, FieldError, Input, Label, Notice } from "@/components/ui/primitives";
import { GradientText } from "@/components/ui/GradientText";
import { DEFAULT_AUTH_DESTINATION, safeInternalPath } from "@/lib/auth-redirect";
import {
  DEFAULT_FREE_MONTHLY_LIMIT,
  DEFAULT_REFERRAL_CREDIT_REWARD,
  DEFAULT_REFERRAL_MONTHLY_CAP,
  tailoredResumes,
} from "@/lib/limits";
import type { LegalVersionSummary } from "@/lib/legal";
import { JOB_COUNTRIES } from "@/lib/job-config";
import { useSession } from "../session-context";
import { trackProductEvent } from "../product-analytics";

export default function Login() {
  const { session } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState("");
  const [nextPath, setNextPath] = useState(DEFAULT_AUTH_DESTINATION);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [google, setGoogle] = useState(true);
  // Signup location targeting (066): coarse job-market signal only — a scope
  // choice and a two-letter country. Feeds /api/jobs/suggest filtering.
  const [signupScope, setSignupScope] = useState<"in_country" | "out_of_country" | "both">("both");
  const [signupCountry, setSignupCountry] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [legalVersions, setLegalVersions] = useState<LegalVersionSummary[]>([]);
  const [legalAccepted, setLegalAccepted] = useState(false);
  // Login also asks for a Terms acknowledgment — the user wants the click on
  // both forms, not just account creation.

  useEffect(() => {
    if (session) setGoogle(!!session.googleEnabled);
    const params = new URLSearchParams(window.location.search);
    // A pre-hydration native form submit can land here with query fields.
    // Scrub them from the address bar so history, Referer, and logs stay clean.
    if (params.has("email") || params.has("password")) {
      window.history.replaceState(null, "", "/login");
    }
    const e = params.get("error");
    const verified = params.get("verified");
    const invite = params.get("invite");
    if (invite) {
      setInviteCode(invite);
      setMode("signup");
    }
    setNextPath(safeInternalPath(params.get("next")));
    if (e) {
      if (e === "google_unconfigured") setErr("Google sign-in isn't set up yet.");
      else if (e === "google_state")
        setErr("Google sign-in expired or switched domains. Please try again from this page.");
      else if (e === "google_signup_acceptance_required" || e === "legal_acceptance_required") {
        setMode("signup");
        setErr("Accept the current Terms and Privacy Policy before creating a Google account.");
      } else setErr("Google sign-in failed. Try again.");
    }
    if (verified === "invalid")
      setErr("That verification link is invalid or expired. Request a new one below.");
    if (verified === "missing")
      setErr("Verification token missing. Request a new link below.");
    if (params.get("timeout"))
      setInfo("You were signed out after a period of inactivity. Log in to continue.");
    fetch("/api/legal/current", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new globalThis.Error("legal_versions_unavailable")))
      .then((data: { versions?: LegalVersionSummary[] }) => setLegalVersions(data.versions ?? []))
      .catch(() => setLegalVersions([]));
  }, [session]);

  async function submit() {
    trackProductEvent("auth_start", {
      context: mode === "login" ? "email:login" : "email:signup",
      authState: "anonymous",
    });
    if (mode === "signup" && (!legalAccepted || legalVersions.length !== 2)) {
      setErr("Review and accept the current Terms and Privacy Policy before creating an account.");
      return;
    }
    setBusy(true);
    setErr("");
    setInfo("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          inviteCode,
          legalVersionIds: mode === "signup" ? legalVersions.map((version) => version.id) : undefined,
          locationScope: mode === "signup" ? signupScope : undefined,
          homeCountry: mode === "signup" ? (signupCountry || undefined) : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || "Failed");
        if (j.code === "email_unverified") {
          setPendingVerifyEmail(j.email || email);
          setNeedsVerification(true);
        }
        return;
      }
      if (j.verificationRequired) {
        setPendingVerifyEmail(j.email || email);
        setNeedsVerification(true);
        if (j.emailSent === false) {
          setErr("Your account was created, but the verification email could not be delivered. Use Resend below after the email service is available.");
        } else {
          setInfo("Verification email queued. Open the link in your inbox to activate login. Check spam if it does not arrive within a few minutes.");
        }
        setMode("login");
        setPassword("");
        return;
      }
      trackProductEvent("auth_verified", {
        context: mode === "login" ? "email:login" : "email:signup",
        authState: "authenticated",
      });
      if (nextPath !== DEFAULT_AUTH_DESTINATION) {
        trackProductEvent("destination_resumed", {
          context: "auth:return_path",
          authState: "authenticated",
        });
      }
      window.location.href = nextPath;
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    const target = pendingVerifyEmail || email;
    if (!target) {
      setErr("Enter your email first.");
      return;
    }
    setResending(true);
    setErr("");
    setInfo("");
    try {
      const r = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Could not resend verification email.");
        return;
      }
      setPendingVerifyEmail(target);
      setInfo("If this account is awaiting verification, a new email was queued. Check your inbox and spam folder in a few minutes.");
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setResending(false);
    }
  }

  const accountBenefits = (
    <div className="flex flex-wrap gap-3">
      {[
        // Production advertised "3 free resumes/month" here long after the free
        // plan dropped to 1. This page sits in front of every signup, so it was
        // the most-read wrong number on the site.
        `${tailoredResumes(DEFAULT_FREE_MONTHLY_LIMIT)} free/month`,
        `Invite reward: ${DEFAULT_REFERRAL_CREDIT_REWARD} credit (max ${DEFAULT_REFERRAL_MONTHLY_CAP}/mo)`,
        "Upload checker included",
      ].map((item) => (
        <span
          key={item}
          className="rsx-chip"
        >
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <AuthShell
      eyebrow="Account"
      title={mode === "login" ? <><GradientText>Welcome back</GradientText>.</> : <>Create your <GradientText>free account</GradientText>.</>}
      description="One login for everything — the checker, the maker, your saved resumes, your exports, and your Premium tools."
      aside={accountBenefits}
      className="rsx-mesh rsx-noise relative"
    >
              <div className="mb-6">
                <h2 className="text-2xl font-bold font-[family-name:var(--font-display)] tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  {mode === "login" ? "Log in" : "Sign up"}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  {mode === "login"
                    ? "Pick up right where you left off."
                    : `${tailoredResumes(DEFAULT_FREE_MONTHLY_LIMIT)} a month to start. No card required.`}
                </p>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "10-256 characters" : "Your password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    aria-describedby={mode === "signup" ? "password-min-length" : undefined}
                  />
                  {mode === "signup" && (
                    <p id="password-min-length" className="mt-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]" role={password.length > 0 && password.length < 10 ? "alert" : undefined}>
                      {password.length === 0
                        ? "Must be at least 10 characters."
                        : password.length < 10
                          ? `${10 - password.length} more character${10 - password.length === 1 ? "" : "s"} needed.`
                          : "Length looks good."}
                    </p>
                  )}
                </div>
                {mode === "login" && (
                  <div className="text-right">
                    <a
                      href="/forgot-password"
                      className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-primary)] rs-underline-anim"
                    >
                      Forgot password?
                    </a>
                  </div>
                )}
                {mode === "login" && (
                  <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-sm text-[var(--color-text-muted)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text-muted)]">
                    Logging in means you continue under the current{" "}
                    <a className="font-semibold text-[var(--color-primary)] hover:underline" href="/terms" target="_blank" rel="noreferrer">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a className="font-semibold text-[var(--color-primary)] hover:underline" href="/privacy" target="_blank" rel="noreferrer">
                      Privacy Policy
                    </a>. New terms are shown for explicit acceptance at signup.
                  </p>
                )}
                {mode === "signup" && (
                  <>
                    <fieldset className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3.5 dark:border-[var(--color-dark-border)]">
                      <legend className="px-1.5 text-sm font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">What jobs are you targeting?</legend>
                      <div className="mt-2 grid gap-2">
                        {([
                          { value: "in_country", label: "In my home country only" },
                          { value: "out_of_country", label: "Abroad / international only" },
                          { value: "both", label: "Both home and international" },
                        ] as const).map((option) => (
                          <label key={option.value} className="flex min-h-9 items-center gap-2 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                            <input type="radio" name="signup-scope" value={option.value} checked={signupScope === option.value} onChange={() => setSignupScope(option.value)} />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {signupScope !== "both" && (
                        <div className="mt-2.5">
                          <Label htmlFor="signup-home-country">Your home country</Label>
                          <select
                            id="signup-home-country"
                            value={signupCountry}
                            onChange={(e) => setSignupCountry(e.target.value)}
                            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
                          >
                            <option value="">Select a country…</option>
                            {JOB_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                    </fieldset>
                    <div>
                      <Label htmlFor="login-invite">
                        Invite code{" "}
                        <span className="text-[var(--color-text-faint)]">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="login-invite"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="Friend invite code"
                      />
                    </div>
                    <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-sm text-[var(--color-text-muted)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text-muted)]">
                      <input
                        type="checkbox"
                        checked={legalAccepted}
                        onChange={(event) => setLegalAccepted(event.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        I have read and accept the{" "}
                        <a className="font-semibold text-[var(--color-primary)] hover:underline" href="/terms" target="_blank" rel="noreferrer">
                          Terms of Service{legalVersions.find((version) => version.documentKey === "terms") ? ` v${legalVersions.find((version) => version.documentKey === "terms")?.versionNumber}` : ""}
                        </a>{" "}
                        and{" "}
                        <a className="font-semibold text-[var(--color-primary)] hover:underline" href="/privacy" target="_blank" rel="noreferrer">
                          Privacy Policy{legalVersions.find((version) => version.documentKey === "privacy") ? ` v${legalVersions.find((version) => version.documentKey === "privacy")?.versionNumber}` : ""}
                        </a>.
                      </span>
                    </label>
                  </>
                )}

                <Button type="submit" fullWidth isLoading={busy} disabled={mode === "signup" && legalVersions.length !== 2} className="rsx-glow">
                  {mode === "login" ? "Log in" : "Sign up"}
                </Button>

                {info && (
                  <Notice variant="success" role="status">
                    {info}
                  </Notice>
                )}
                {err && <FieldError>{err}</FieldError>}

                {(needsVerification || pendingVerifyEmail) && (
                  <Button
                    type="button"
                    onClick={resendVerification}
                    variant="outline"
                    fullWidth
                    isLoading={resending}
                  >
                    Resend verification email
                  </Button>
                )}

                {google ? (
                  <>
                    <div className="flex items-center gap-3 my-4 text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)] text-xs uppercase tracking-widest">
                      <div className="flex-1 h-px bg-[var(--color-border)] dark:bg-[var(--color-dark-border)]" />
                      or
                      <div className="flex-1 h-px bg-[var(--color-border)] dark:bg-[var(--color-dark-border)]" />
                    </div>
                    <a
                      href={(() => {
                        const params = new URLSearchParams({ next: nextPath });
                        if (mode === "signup") {
                          params.set("signup", "1");
                          for (const version of legalVersions) params.append("legalVersionId", version.id);
                        }
                        // Carry the referral invite through the OAuth round-trip
                        // so Google signups credit the referrer like email ones.
                        if (inviteCode.trim()) params.set("invite", inviteCode.trim());
                        return `/api/auth/google/start?${params.toString()}`;
                      })()}
                      onClick={(event) => {
                        if (mode === "signup" && (!legalAccepted || legalVersions.length !== 2)) {
                          event.preventDefault();
                          setErr("Review and accept the current Terms and Privacy Policy before creating an account.");
                          return;
                        }
                        trackProductEvent("auth_start", {
                          context: mode === "signup" ? "google:signup" : "google:login",
                          authState: "anonymous",
                        });
                      }}
                      className="inline-flex items-center justify-center gap-3 w-full px-4 py-3 rounded-full text-sm font-semibold border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-white text-[#3c4043] hover:bg-slate-50 transition-colors rsx-hover-lift"
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.7 17.6 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-17z" />
                        <path fill="#FBBC05" d="M10.3 28.4c-.5-1.5-.8-3-.8-4.4s.3-3 .8-4.4l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.5l7.8-6.1z" />
                        <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.1-5.5c-2 1.3-4.6 2.1-7.9 2.1-6.4 0-11.8-4.2-13.7-9.9l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
                      </svg>
                      Continue with Google
                    </a>
                  </>
                ) : (
                  <p className="text-sm text-center text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                    Google sign-in is unavailable on this deployment — use email
                    and password.
                  </p>
                )}

                <p className="text-center text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mt-2">
                  {mode === "login" ? "New here? " : "Already have an account? "}
                  <button
                    type="button"
                    className="font-semibold text-[var(--color-primary)] hover:underline"
                    onClick={() => {
                      setMode(mode === "login" ? "signup" : "login");
                      setErr("");
                      setInfo("");
                    }}
                  >
                    {mode === "login" ? "Create an account" : "Log in"}
                  </button>
                </p>
              </form>
    </AuthShell>
  );
}
