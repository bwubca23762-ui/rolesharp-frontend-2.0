import { NextRequest, NextResponse } from "next/server";
import { checkAdminCreds, setAdminSession, verifyAdminTotp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// Separate admin login — NOT tied to the users table.
export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-login", 5);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.user !== "string" || typeof body.password !== "string" || body.user.length > 128 || body.password.length > 256 || (body.totp !== undefined && (typeof body.totp !== "string" || body.totp.length > 6))) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 400 });
  }
  const { user, password, totp } = body;
  if (!checkAdminCreds(user, password) || !verifyAdminTotp(String(totp ?? ""))) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
  }
  await setAdminSession();
  await recordAdminAction("admin_login", {
    details: { authenticationMethod: "break_glass" },
  });
  return NextResponse.json({ ok: true, authenticationMethod: "break_glass" });
}
