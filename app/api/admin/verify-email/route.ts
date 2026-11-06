import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { ensureInviteCode } from "@/lib/credits";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { sendUserVerification } from "@/lib/email-verification";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("users.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { email, action } = body;
  if (typeof email !== "string" || (action !== "verify" && action !== "resend")) return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return NextResponse.json({ error: "email_required" }, { status: 400 });

  // Admin-triggered resend of the verification email. Distinct from the
  // mark-verified default: this sends the real link so the user completes the
  // flow themselves (audited the same way).
  if (action === "resend") {
    const user = (await q<{ id: string; email: string; email_verified_at: string | null }>(
      "select id, email, email_verified_at from users where lower(email)=lower($1)",
      [cleanEmail],
    ))[0];
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    if (user.email_verified_at) return NextResponse.json({ error: "already_verified" }, { status: 409 });
    try {
      await sendUserVerification(user.id, user.email);
    } catch {
      return NextResponse.json({ error: "email_send_failed" }, { status: 502 });
    }
    await recordAdminAction("verify_email_resend", { targetUserId: user.id, targetEmail: user.email, details: { by: "admin_panel" } });
    return NextResponse.json({ ok: true, action: "resent" });
  }

  const user = (await q<{ id: string; email: string; email_verified_at: string | null }>(
    "select id, email, email_verified_at from users where lower(email)=lower($1)",
    [cleanEmail],
  ))[0];
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  await q("update users set email_verified_at=coalesce(email_verified_at, now()) where id=$1", [user.id]);
  await ensureInviteCode(user.id);
  await recordAdminAction("email_verify_manual", { targetUserId: user.id, targetEmail: user.email, details: { wasVerified: !!user.email_verified_at } });
  return NextResponse.json({ ok: true, action: "verified" });
}
