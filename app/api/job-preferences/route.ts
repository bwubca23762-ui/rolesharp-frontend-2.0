import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sameOriginRequest } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";
import { getJobPreferences, JobPreferencesSchema, saveJobPreferences } from "@/lib/job-preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Declared deal breakers. GET is the user's own row (null when unset); PUT
// upserts after the same-origin + rate-limit + zod gauntlet every mutating
// route here runs.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const preferences = await getJobPreferences(user.id);
  return NextResponse.json({ preferences }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "job-preferences", 20);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const parsed = JobPreferencesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const preferences = await saveJobPreferences(user.id, parsed.data);
  return NextResponse.json({ ok: true, preferences });
}
