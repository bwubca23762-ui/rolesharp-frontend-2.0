import { NextRequest, NextResponse } from "next/server";
import { currentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({ current: z.string().optional(), next: z.string().min(10).max(256) });

export async function POST(req: NextRequest) {
  // Auth FIRST — otherwise an unauthenticated attacker could burn the rate
  // bucket and lock the real user out of changing their password.
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  // Throttle so a stolen session can't brute-force the current password.
  const limited = await rateLimit(req, "pw-change", 6);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "New password must be 10-256 characters" }, { status: 400 });
  const { current, next } = parsed.data;

  const row = (await q<{ password_hash: string | null }>("select password_hash from users where id=$1", [user.id]))[0];
  if (!row) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (row.password_hash && !verifyPassword(current || "", row.password_hash)) {
    return NextResponse.json({ error: "Current password is wrong" }, { status: 401 });
  }
  await q("update users set password_hash=$1, auth_version=auth_version+1 where id=$2", [hashPassword(next), user.id]);
  return NextResponse.json({ ok: true, created: !row.password_hash });
}
