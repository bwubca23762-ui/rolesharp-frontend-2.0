import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { grantPremium } from "@/lib/entitlements";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

const ALLOWED_DAYS = new Set([7, 30, 90, 365]);

export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("users.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-premium", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { email, action, days } = body;
  if (typeof email !== "string" || (action !== "grant" && action !== "revoke")) return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const user = (await q<{ id: string; email: string; premium_until: string | null }>(
    "select id, email, premium_until from users where lower(email)=lower($1)",
    [cleanEmail],
  ))[0];
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  if (action === "revoke") {
    // premium_source must clear with premium_until, or the row keeps
    // advertising a source (student/admin) it no longer has.
    await q("update users set premium_until=null, premium_source=null where id=$1", [user.id]);
  } else {
    const n = Number(days);
    if (!ALLOWED_DAYS.has(n)) return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
    await grantPremium(user.id, n, "admin");
  }

  const updated = (await q<{ email: string; premium_until: string | null }>(
    "select email, premium_until from users where id=$1",
    [user.id],
  ))[0];
  if (!updated) return NextResponse.json({ error: "user not found" }, { status: 404 });
  // Single audit write via recordAdminAction — the previous raw insert
  // duplicated this row with staff_account_id = null ("system" in the log).
  await recordAdminAction(action === "revoke" ? "premium_revoke" : "premium_grant", {
    targetUserId: user.id,
    targetEmail: user.email,
    details: { days: action === "revoke" ? null : Number(days), premiumUntil: updated.premium_until },
  });
  return NextResponse.json({
    ok: true,
    email: updated.email,
    premiumUntil: updated.premium_until,
    premium: !!updated.premium_until && new Date(updated.premium_until) > new Date(),
  });
}
