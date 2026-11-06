import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { digestOneTimeToken } from "@/lib/security-tokens";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "reset-password", 5);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || token.length !== 64 || typeof password !== "string" || password.length < 10 || password.length > 256) {
    return NextResponse.json({ error: "A valid token and password (10-256 characters) are required" }, { status: 400 });
  }

  const hash = hashPassword(password);
  const rows = await q<{ id: string }>(
    `update users
     set password_hash=$1,
         reset_token=null,
         reset_token_expires_at=null,
         auth_version=auth_version+1
     where reset_token=$2 and reset_token_expires_at > now()
     returning id`,
    [hash, digestOneTimeToken(token)],
  );
  if (!rows[0]) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });

  return NextResponse.json({ ok: true });
}
