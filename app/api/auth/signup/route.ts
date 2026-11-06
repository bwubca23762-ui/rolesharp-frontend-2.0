import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { deliverUserVerification, prepareUserVerification } from "@/lib/email-verification";
import { emailEnabled } from "@/lib/email";
import { ensureInviteCode } from "@/lib/credits";
import { env } from "@/lib/env";
import { createDevUser, getDevUserByEmail } from "@/lib/local-dev-store";
import { setSession } from "@/lib/auth";
import { isAcademicEmail, sendStudentNudgeEmail } from "@/lib/student";
import { isDisposableEmail, checkIpSignupVelocity, clientIpFromRequest } from "@/lib/anti-farming";
import {
  currentRequiredLegalVersions,
  legalRequestEvidenceDigest,
  recordExactLegalAcceptances,
} from "@/lib/legal";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "auth-signup", 5);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const { email, password, inviteCode, legalVersionIds, locationScope, homeCountry } = await req.json().catch(() => ({}));
  // Signup location capture (066): a coarse, optional job-market signal —
  // scope choices and a two-letter country code only, never a precise place.
  const SCOPE = ["in_country", "out_of_country", "both"] as const;
  const scope = SCOPE.includes(locationScope) ? (locationScope as (typeof SCOPE)[number]) : "both";
  const home = typeof homeCountry === "string" && /^[A-Za-z]{2}$/u.test(homeCountry) ? homeCountry.toUpperCase() : null;
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > 320 || typeof password !== "string" || password.length < 10 || password.length > 256) {
    return NextResponse.json({ error: "Email and password (10-256 characters) required" }, { status: 400 });
  }
  if (env.localDevMode) {
    if (!Array.isArray(legalVersionIds) || legalVersionIds.length !== 2) {
      return NextResponse.json({ error: "legal_acceptance_required" }, { status: 400 });
    }
    const existing = await getDevUserByEmail(cleanEmail);
    if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    const user = await createDevUser(cleanEmail, hashPassword(password));
    await ensureInviteCode(user.id);
    await setSession(user.id, user.email);
    return NextResponse.json({ ok: true, id: user.id, email: user.email, localDev: true });
  }
  const currentLegal = await currentRequiredLegalVersions();
  if (currentLegal.length !== 2) {
    return NextResponse.json({ error: "legal_versions_unavailable" }, { status: 503 });
  }
  if (!Array.isArray(legalVersionIds)
    || legalVersionIds.length !== currentLegal.length
    || new Set(legalVersionIds).size !== currentLegal.length
    || currentLegal.some((version) => !legalVersionIds.includes(version.id))) {
    return NextResponse.json({ error: "legal_acceptance_required", versions: currentLegal }, { status: 400 });
  }
  if (process.env.NODE_ENV === "production" && !emailEnabled()) {
    return NextResponse.json({ error: "Email verification is not configured yet. Add SMTP settings first." }, { status: 503 });
  }
  // Anti-farming (067): disposable inboxes and IP velocity are rejected here,
  // before any account exists. Local dev is exempt (no real IPs).
  if (!env.localDevMode) {
    if (await isDisposableEmail(cleanEmail)) {
      return NextResponse.json({ error: "disposable_email_rejected", message: "Temporary email providers cannot be used to create an account." }, { status: 403 });
    }
    const ip = clientIpFromRequest(req);
    const velocity = await checkIpSignupVelocity(ip).catch(() => ({ ok: true as const, count: 0 }));
    if (!velocity.ok) {
      return NextResponse.json({ error: "signup_rate_limited", message: "Too many accounts from this connection. Contact support if this is a mistake." }, { status: 429 });
    }
  }
  const id = randomUUID();
  const requestEvidenceDigest = legalRequestEvidenceDigest({
    headers: req.headers,
    userId: id,
    versionIds: legalVersionIds,
    surface: "email_signup",
  });
  let prepared;
  try {
    prepared = await withTransaction(async (query) => {
      const referrer = inviteCode
        ? (await query<{ id: string }>(
          "select id from users where lower(invite_code)=lower($1) for key share",
          [String(inviteCode).trim()],
        ))[0]
        : null;
      const signupIp = clientIpFromRequest(req);
      await query(
        "insert into users (id, email, password_hash, email_verified_at, referred_by, signup_ip, last_ip) values ($1,$2,$3,null,$4,$5,$5)",
        [id, cleanEmail, hashPassword(password), referrer?.id ?? null, signupIp],
      );
      await ensureInviteCode(id, query);
      // Location scope seeded from signup (066); the user can change it in
      // settings. Absent answer = 'both' + null home country.
      await query(
        `insert into user_job_preferences (user_id, location_scope, home_country)
         values ($1,$2,$3) on conflict (user_id) do nothing`,
        [id, scope, home],
      );
      await recordExactLegalAcceptances({
        query,
        userId: id,
        versionIds: legalVersionIds,
        surface: "email_signup",
        requestEvidenceDigest,
      });
      return prepareUserVerification(id, cleanEmail, query);
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    throw error;
  }
  // Database-owned signup state is committed together. A transport failure is
  // recorded on the token and returned as recoverable so the UI can offer resend.
  let emailSent = true;
  try {
    await deliverUserVerification(prepared);
  } catch (e) {
    emailSent = false;
    console.error("signup: verification email failed (account still created):", e);
  }
  // Signed up with an academic address? Nudge them toward the student offer.
  // Fire-and-forget: never blocks or fails the signup.
  if (isAcademicEmail(cleanEmail)) {
    sendStudentNudgeEmail(cleanEmail).catch(() => {});
  }
  // Do NOT leak the email back to the client — the caller already knows it, and
  // exposing it in the response is a privacy leak (visible to proxies, logs, and
  // anyone intercepting the request).
  return NextResponse.json({ ok: true, verificationRequired: true, emailSent });
}
