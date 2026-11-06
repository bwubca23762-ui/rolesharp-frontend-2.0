import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { randomBytes } from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail, emailEnabled } from "@/lib/email";
import { env } from "@/lib/env";
import { digestOneTimeToken } from "@/lib/security-tokens";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "forgot-password", 3);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.trim() || email.length > 320) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Always return success to prevent email enumeration
  const rows = await q<{ id: string; email: string }>("select id, email from users where email = $1", [String(email).toLowerCase().trim()]);
  if (!rows[0]) return NextResponse.json({ ok: true }); // silently succeed

  const token = randomBytes(32).toString("hex");
  await q("update users set reset_token=$1, reset_token_expires_at=now() + interval '1 hour' where id=$2", [digestOneTimeToken(token), rows[0].id]);

  const resetUrl = `${env.siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
  if (emailEnabled()) {
    await sendMail({
      to: rows[0].email,
      type: "password_reset",
      subject: "Reset your RoleSharp password",
      text: `You requested a password reset. Go to ${resetUrl} to reset your password. This link expires in 1 hour. If you didn't request this, ignore this email.`,
      html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
