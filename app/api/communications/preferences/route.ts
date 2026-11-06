import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getCommunicationPreferences, updateCommunicationPreferences } from "@/lib/communications";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getCommunicationPreferences(user.id), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = await rateLimit(req, "communication-preferences", 20);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = z.object({ productUpdates: z.boolean(), careerTips: z.boolean() }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_preferences" }, { status: 400 });
  return NextResponse.json(await updateCommunicationPreferences(user.id, parsed.data), { headers: { "Cache-Control": "private, no-store" } });
}
