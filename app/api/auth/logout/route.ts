import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const extraCookies = await clearSession();
  const res = NextResponse.json({ ok: true });
  for (const c of extraCookies) res.headers.append("Set-Cookie", c);
  return res;
}
