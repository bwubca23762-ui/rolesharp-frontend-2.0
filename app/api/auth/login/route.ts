import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { verifyPassword, setSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { getDevUserByEmail } from "@/lib/local-dev-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "auth-login", 8);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password || email.length > 320 || password.length > 256) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (env.localDevMode) {
    const u = await getDevUserByEmail(String(email));
    if (!u || !verifyPassword(password, u.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await setSession(u.id, u.email);
    const premium = !!u.premiumUntil && new Date(u.premiumUntil) > new Date();
    return NextResponse.json({ id: u.id, email: u.email, premium, localDev: true });
  }

  const rows = await q<{ id: string; email: string; password_hash: string; premium_until: string | null; email_verified_at: string | null; auth_version: number; is_banned: boolean }>(
    "select id, email, password_hash, premium_until, email_verified_at, auth_version, is_banned from users where lower(email)=lower($1)",
    [email],
  );
  const u = rows[0];
  if (!u || !u.password_hash || !verifyPassword(password, u.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  // Hard ban (067): a suspended account cannot log back in, even with the
  // right password. The message names the state without leaking details.
  if (u.is_banned) {
    return NextResponse.json({ error: "account_suspended", message: "Your account has been permanently suspended for violating platform policies." }, { status: 403 });
  }
  if (!u.email_verified_at) {
    return NextResponse.json({ error: "Please verify your email before logging in.", code: "email_unverified", email: u.email }, { status: 403 });
  }
  await setSession(u.id, u.email, undefined, u.auth_version);
  const premium = !!u.premium_until && new Date(u.premium_until) > new Date();
  return NextResponse.json({ id: u.id, email: u.email, premium });
}
