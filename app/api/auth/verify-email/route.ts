import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { currentUser, setSession } from "@/lib/auth";
import { verifyEmailToken } from "@/lib/email-verification";
import { ensureInviteCode } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Mail links are GET by nature; verification is a one-time token, so the
  // request itself needs no CSRF token. A HEAD preflight must never mutate
  // anything (some link checkers and security scanners send HEAD first).
  if (req.method === "HEAD") {
    return new NextResponse(null, { status: 204 });
  }
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${env.siteUrl}/login?verified=missing`);

  const verified = await verifyEmailToken(token);
  if (!verified) return NextResponse.redirect(`${env.siteUrl}/login?verified=invalid`);

  await ensureInviteCode(verified.user_id);
  // Referral credit is granted later, when this user generates their first
  // resume (Option B — proves a real active user, not a throwaway signup).

  // Login-CSRF guard: clicking a verification link while signed in as a
  // DIFFERENT account must not silently replace that session (shared-machine
  // scenario — attacker sends their own verify link, victim's account becomes
  // the attacker's). The visitor keeps their current session and lands on
  // login with an explanation; the token's own account is verified either
  // way, so the legit flow is unaffected.
  const existing = await currentUser();
  if (existing && existing.id !== verified.user_id) {
    return NextResponse.redirect(`${env.siteUrl}/login?verified=conflict`);
  }

  await setSession(verified.user_id, verified.email, undefined, verified.auth_version);
  return NextResponse.redirect(`${env.siteUrl}/build?verified=1`);
}
