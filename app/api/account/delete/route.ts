import { NextRequest, NextResponse } from "next/server";
import { currentUser, verifyPassword, clearSession, consumeDeletionReauth } from "@/lib/auth";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { deleteDevUser, getDevUserById } from "@/lib/local-dev-store";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { deleteAccountLifecycle } from "@/lib/account-deletion";

export const runtime = "nodejs";

// Permanently delete the account + all its resumes/payments.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "account-delete", 6);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const { password } = await req.json().catch(() => ({}));

  if (env.localDevMode) {
    const account = await getDevUserById(user.id);
    if (!account || !verifyPassword(password ?? "", account.passwordHash)) {
      return NextResponse.json({ error: "Password is wrong" }, { status: 401 });
    }
    await deleteDevUser(user.id);
    const extraCookies = await clearSession();
    const response = NextResponse.json({ ok: true });
    for (const cookie of extraCookies) response.headers.append("Set-Cookie", cookie);
    return response;
  }

  const row = (await q<{ password_hash: string | null }>("select password_hash from users where id=$1", [user.id]))[0];
  if (!row) return NextResponse.json({ error: "account_unavailable" }, { status: 404 });
  if (row.password_hash) {
    if (!verifyPassword(password ?? "", row.password_hash)) {
      return NextResponse.json({ error: "Password is wrong" }, { status: 401 });
    }
  } else if (!(await consumeDeletionReauth(user.id))) {
    return NextResponse.json({
      error: "google_reauthentication_required",
      reauthUrl: "/api/account/delete/google/start",
    }, { status: 401 });
  }
  const deletion = await deleteAccountLifecycle(user.id);
  if (!deletion.deleted) {
    return NextResponse.json({ error: "account_unavailable" }, { status: 404 });
  }
  const extraCookies = await clearSession();
  const res = NextResponse.json({ ok: true });
  for (const c of extraCookies) res.headers.append("Set-Cookie", c);
  return res;
}
