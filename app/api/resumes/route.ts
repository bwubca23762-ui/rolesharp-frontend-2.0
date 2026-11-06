import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listUserResumes } from "@/lib/db";
import { env } from "@/lib/env";
import { listDevUserResumes } from "@/lib/local-dev-store";

export const runtime = "nodejs";

// A user's saved resumes (premium: manage multiple versions). The no-store
// header is defense-in-depth on top of the config-level /api rule: this
// response is per-user, and the audits demonstrated that a missing cache
// directive lets the CDN stamp a 4-hour TTL onto it at a shared URL.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  if (env.localDevMode) return NextResponse.json(await listDevUserResumes(user.id), { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json(await listUserResumes(user.id, 100), { headers: { "Cache-Control": "private, no-store" } });
}
