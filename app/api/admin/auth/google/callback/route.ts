import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  activateGoogleStaff,
  consumeStaffOAuth,
  createStaffSession,
  recordStaffLoginEvent,
  resolveStaffReturnPath,
  staffGoogleRedirectUri,
} from "@/lib/staff-auth";

export const runtime = "nodejs";

const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function redirectWithError(code: string) {
  return NextResponse.redirect(new URL(`/admin?error=${encodeURIComponent(code)}`, env.siteUrl));
}

export async function GET(req: NextRequest) {
  if (!env.staffGoogleEnabled) return redirectWithError("staff_google_unconfigured");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) {
    await recordStaffLoginEvent(null, "failed", "staff_oauth_callback_incomplete");
    return redirectWithError("staff_google_state");
  }
  let verifiedEmail: string | null = null;
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.staffGoogleClientId,
        client_secret: env.staffGoogleClientSecret,
        redirect_uri: staffGoogleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) throw new Error("staff_oauth_token_exchange_failed");
    const token = await tokenResponse.json() as { id_token?: string };
    if (!token.id_token) throw new Error("staff_oauth_id_token_missing");
    const unverified = await jwtVerify(token.id_token, GOOGLE_KEYS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: env.staffGoogleClientId,
    });
    const nonce = typeof unverified.payload.nonce === "string" ? unverified.payload.nonce : "";
    const transaction = await consumeStaffOAuth(state, nonce);
    const subject = typeof unverified.payload.sub === "string" ? unverified.payload.sub : "";
    const email = typeof unverified.payload.email === "string" ? unverified.payload.email.toLowerCase() : "";
    verifiedEmail = email || null;
    const displayName = typeof unverified.payload.name === "string" ? unverified.payload.name : null;
    if (!subject || !email || unverified.payload.email_verified !== true) {
      await recordStaffLoginEvent(email || null, "denied", "staff_google_email_unverified");
      return redirectWithError("staff_access_denied");
    }
    const staffAccountId = await activateGoogleStaff({ subject, email, displayName });
    await createStaffSession(staffAccountId, "google");
    const returnPath = await resolveStaffReturnPath(staffAccountId, transaction.returnPath);
    return NextResponse.redirect(new URL(returnPath, env.siteUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "staff_oauth_failed";
    console.error("staff_oauth_callback_failed", { error: message });
    const denied = message === "staff_not_preapproved"
      || message === "staff_suspended"
      || message === "staff_revoked"
      || message === "staff_subject_mismatch"
      || message === "staff_access_denied";
    await recordStaffLoginEvent(verifiedEmail, denied ? "denied" : "failed", denied ? message : "staff_oauth_callback_failed");
    return redirectWithError(denied ? "staff_access_denied" : "staff_google_failed");
  }
}
