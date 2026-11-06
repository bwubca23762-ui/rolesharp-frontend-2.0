import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getNotificationPreferences, setNotificationPreferences } from "@/lib/notifications";
import { sameOriginRequest } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Preferences = z.object({
  productUpdatesEnabled: z.boolean(),
  careerTipsEnabled: z.boolean(),
}).strict();

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ preferences: await getNotificationPreferences(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "notification-preferences", 30);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Preferences.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_notification_preferences" }, { status: 400 });
  const preferences = await setNotificationPreferences(user.id, parsed.data);
  return NextResponse.json({ preferences }, { headers: { "Cache-Control": "private, no-store" } });
}
