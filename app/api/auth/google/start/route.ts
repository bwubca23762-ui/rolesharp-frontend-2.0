import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { safeInternalPath } from "@/lib/auth-redirect";
import { currentRequiredLegalVersions } from "@/lib/legal";

export const runtime = "nodejs";

// Kick off Google OAuth. Stores CSRF, nonce, and safe return-path cookies before redirecting.
export async function GET(req: Request) {
  if (!env.googleEnabled) {
    return NextResponse.redirect(`${env.siteUrl}/login?error=google_unconfigured`);
  }
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  const requestUrl = new URL(req.url);
  const nextPath = safeInternalPath(requestUrl.searchParams.get("next"));
  const signup = requestUrl.searchParams.get("signup") === "1";
  // Referral invite codes survive the OAuth round-trip in a short-lived cookie,
  // the same carrier as the CSRF state and legal acceptance. Format-checked
  // here so the callback never has to trust arbitrary cookie text.
  const inviteRaw = requestUrl.searchParams.get("invite") ?? "";
  const invite = /^[A-Za-z0-9]{4,24}$/.test(inviteRaw.trim()) ? inviteRaw.trim() : "";
  const requestedLegalVersionIds = requestUrl.searchParams.getAll("legalVersionId");
  let legalVersionIds: string[] = [];
  if (signup) {
    const current = await currentRequiredLegalVersions();
    legalVersionIds = current.map((version) => version.id);
    if (current.length !== 2
      || requestedLegalVersionIds.length !== current.length
      || requestedLegalVersionIds.some((id) => !legalVersionIds.includes(id))) {
      return NextResponse.redirect(`${env.siteUrl}/login?error=legal_acceptance_required`);
    }
  }
  const secure = env.siteUrl.startsWith("https://");
  const cookieName = secure ? "__Host-g_state" : "g_state";
  const nonceCookieName = secure ? "__Host-g_nonce" : "g_nonce";
  const nextCookieName = secure ? "__Host-g_next" : "g_next";
  const legalCookieName = secure ? "__Host-g_legal" : "g_legal";
  const inviteCookieName = secure ? "__Host-g_invite" : "g_invite";
  (await cookies()).set(cookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure,
  });
  (await cookies()).set(nonceCookieName, nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure,
  });
  (await cookies()).set(nextCookieName, nextPath, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure,
  });
  (await cookies()).set(legalCookieName, JSON.stringify({ signup, legalVersionIds }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure,
  });
  if (invite) {
    (await cookies()).set(inviteCookieName, invite, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure,
    });
  }

  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", env.googleClientId);
  u.searchParams.set("redirect_uri", `${env.siteUrl}/api/auth/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("nonce", nonce);
  u.searchParams.set("access_type", "online");
  u.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(u.toString());
}
