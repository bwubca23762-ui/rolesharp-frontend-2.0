import { NextRequest, NextResponse } from "next/server";
import { currentUser, verifyPassword } from "@/lib/auth";
import { q, withTransaction } from "@/lib/db";
import { deliverUserVerification, prepareUserVerification } from "@/lib/email-verification";
import { emailEnabled } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  // Same-origin mutation guard — a cross-site form must not trigger a
  // verification email to an attacker-chosen address on a signed-in session.
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "email-change", 5);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Valid email and password required" }, { status: 400 });
  const { email, password } = parsed.data;
  const cleanEmail = email.trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && !emailEnabled()) {
    return NextResponse.json({ error: "Email verification is not configured yet. Add SMTP settings first." }, { status: 503 });
  }

  const row = (await q<{ password_hash: string }>("select password_hash from users where id=$1", [user.id]))[0];
  if (row && !row.password_hash) {
    // Google-only account: there is no password to check, and "Password is
    // wrong" would send the user hunting for one they never set. Password
    // setup in Security is the gate for email changes here.
    return NextResponse.json({ error: "This account uses Google sign-in. Set a password in Security first, then change your email here." }, { status: 409 });
  }
  if (!row || !verifyPassword(password ?? "", row.password_hash)) {
    return NextResponse.json({ error: "Password is wrong" }, { status: 401 });
  }
  const prepared = await withTransaction(async (query) => {
    const locked = await query<{ id: string }>(
      "select id from users where id=$1 for update",
      [user.id],
    );
    if (!locked[0]) return null;
    const taken = await query(
      "select id from users where (lower(email)=lower($1) or lower(pending_email)=lower($1)) and id<>$2",
      [cleanEmail, user.id],
    );
    if (taken.length) return "taken" as const;
    await query("update users set pending_email=$1 where id=$2", [cleanEmail, user.id]);
    await query("update email_verification_tokens set used_at=now() where user_id=$1 and used_at is null", [user.id]);
    return prepareUserVerification(user.id, cleanEmail, query);
  });
  if (!prepared) return NextResponse.json({ error: "account_unavailable" }, { status: 409 });
  if (prepared === "taken") return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  let emailSent = true;
  try { await deliverUserVerification(prepared); } catch { emailSent = false; }
  return NextResponse.json({ ok: true, pendingEmail: cleanEmail, verificationRequired: true, emailSent });
}
