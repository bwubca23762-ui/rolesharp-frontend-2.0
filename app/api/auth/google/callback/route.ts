import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { q, withTransaction } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { ensureInviteCode } from "@/lib/credits";
import { safeInternalPath } from "@/lib/auth-redirect";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { legalRequestEvidenceDigest, recordExactLegalAcceptances } from "@/lib/legal";

export const runtime = "nodejs";

// Google redirects here with ?code. Exchange -> userinfo -> find/create user -> session.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const secure = env.siteUrl.startsWith("https://");
  const cookieName = secure ? "__Host-g_state" : "g_state";
  const nonceCookieName = secure ? "__Host-g_nonce" : "g_nonce";
  const nextCookieName = secure ? "__Host-g_next" : "g_next";
  const legalCookieName = secure ? "__Host-g_legal" : "g_legal";
  const inviteCookieName = secure ? "__Host-g_invite" : "g_invite";
  const saved = jar.get(cookieName)?.value;
  const savedNonce = jar.get(nonceCookieName)?.value;
  const nextPath = safeInternalPath(jar.get(nextCookieName)?.value);
  const legalCookie = jar.get(legalCookieName)?.value;
  // Invite codes are format-validated when the OAuth flow starts; re-check the
  // shape anyway because cookies are attacker-writable on the client.
  const inviteRaw = (jar.get(inviteCookieName)?.value ?? "").trim();
  const inviteCode = /^[A-Za-z0-9]{4,24}$/.test(inviteRaw) ? inviteRaw : "";
  let legalTransaction: { signup: boolean; legalVersionIds: string[] } = { signup: false, legalVersionIds: [] };
  try {
    const parsed = JSON.parse(legalCookie ?? "null") as unknown;
    if (parsed && typeof parsed === "object" && "signup" in parsed && "legalVersionIds" in parsed) {
      const candidate = parsed as { signup?: unknown; legalVersionIds?: unknown };
      legalTransaction = {
        signup: candidate.signup === true,
        legalVersionIds: Array.isArray(candidate.legalVersionIds)
          ? candidate.legalVersionIds.filter((value): value is string => typeof value === "string")
          : [],
      };
    }
  } catch {
    legalTransaction = { signup: false, legalVersionIds: [] };
  }
  jar.delete(cookieName);
  jar.delete(nonceCookieName);
  jar.delete(nextCookieName);
  jar.delete(legalCookieName);
  jar.delete(inviteCookieName);

  if (!code || !state || state !== saved) {
    return NextResponse.redirect(`${env.siteUrl}/login?error=google_state`);
  }
  try {
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: `${env.siteUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    }).then((r) => r.json());
    if (!tok.access_token || !tok.id_token || !savedNonce) throw new Error("incomplete oauth token response");
    const verifiedIdToken = await jwtVerify(tok.id_token, createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")), {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: env.googleClientId,
    });
    if (verifiedIdToken.payload.nonce !== savedNonce) throw new Error("oauth_nonce_mismatch");

    const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${tok.access_token}` },
    }).then((r) => r.json());
    const email = (info.email as string)?.toLowerCase();
    if (!email || info.verified_email !== true) throw new Error("unverified email");

    let user = (await q<{ id: string; email: string; auth_version: number; password_hash: string | null; email_verified_at: string | null }>(
      "select id, email, auth_version, password_hash, email_verified_at from users where lower(email)=$1",
      [email],
    ))[0];
    if (!user) {
      if (!legalTransaction.signup || legalTransaction.legalVersionIds.length !== 2) {
        return NextResponse.redirect(`${env.siteUrl}/login?error=google_signup_acceptance_required`);
      }
      const id = randomUUID();
      const requestEvidenceDigest = legalRequestEvidenceDigest({
        headers: req.headers,
        userId: id,
        versionIds: legalTransaction.legalVersionIds,
        surface: "google_signup",
      });
      await withTransaction(async (query) => {
        // Same referral resolution as email signup: a valid invite code attaches
        // the referrer, an unknown one is silently ignored (never blocks signup).
        const referrer = inviteCode
          ? (await query<{ id: string }>(
            "select id from users where lower(invite_code)=lower($1) for key share",
            [inviteCode],
          ))[0]
          : null;
        await query("insert into users (id, email, password_hash, email_verified_at, referred_by) values ($1,$2,null,now(),$3)", [id, email, referrer?.id ?? null]);
        await ensureInviteCode(id, query);
        await recordExactLegalAcceptances({
          query,
          userId: id,
          versionIds: legalTransaction.legalVersionIds,
          surface: "google_signup",
          requestEvidenceDigest,
        });
      });
      user = { id, email, auth_version: 0, password_hash: null, email_verified_at: new Date().toISOString() };
    } else if (user.password_hash && !user.email_verified_at) {
      // Do not attach Google to an unverified password account.  A user who
      // pre-registered someone else's address must prove it through the
      // password-account verification flow before OAuth can link to the row.
      return NextResponse.redirect(`${env.siteUrl}/login?error=google_email_pending`);
    } else {
      await q("update users set email_verified_at=coalesce(email_verified_at, now()) where id=$1", [user.id]);
    }
    await ensureInviteCode(user.id);
    await setSession(user.id, user.email, undefined, user.auth_version);
    return NextResponse.redirect(new URL(nextPath, env.siteUrl));
  } catch (error) {
    console.error("google_oauth_callback_failed", error);
    return NextResponse.redirect(`${env.siteUrl}/login?error=google_failed`);
  }
}
