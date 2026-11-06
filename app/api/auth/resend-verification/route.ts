import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendUserVerification } from "@/lib/email-verification";
import { emailEnabled } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "auth-resend-verification", 3);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const { email } = await req.json().catch(() => ({}));
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (process.env.NODE_ENV === "production" && !emailEnabled()) {
    return NextResponse.json({ error: "Email verification is not configured yet. Add SMTP settings first." }, { status: 503 });
  }

  const user = (await q<{ id: string; email: string; email_verified_at: string | null }>(
    "select id, email, email_verified_at from users where lower(email)=lower($1)",
    [cleanEmail],
  ))[0];

  if (user && !user.email_verified_at) {
    await sendUserVerification(user.id, user.email).catch((error) => {
      // Keep the public response identical for existing and non-existing users
      // to prevent account enumeration. The central email logger and service
      // journal retain the delivery failure for administrators.
      console.error("resend verification email failed:", error);
    });
  }

  return NextResponse.json({ ok: true });
}
