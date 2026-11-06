import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead, updateNotificationState } from "@/lib/notifications";
import { sameOriginRequest } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StateChange = z.object({
  notificationId: z.string().uuid().optional(),
  action: z.enum(["read", "dismiss", "archive", "read_all"]),
}).strict();

function authContext(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  return { userId: user.id, premium: user.premium, premiumSource: user.premiumSource };
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
  const before = url.searchParams.get("before");
  const includeArchived = url.searchParams.get("archived") === "1";
  const notifications = await listNotifications(authContext(user), { limit, before, includeArchived });
  return NextResponse.json({ notifications }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "notification-state", 120);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = StateChange.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_notification_state" }, { status: 400 });
  // read_all is the bulk affordance: one statement marks every effective,
  // non-critical publication read. notificationId is deliberately unused here.
  if (parsed.data.action === "read_all") {
    const updated = await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true, updated }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (!parsed.data.notificationId) {
    return NextResponse.json({ error: "invalid_notification_state" }, { status: 400 });
  }
  const updated = await updateNotificationState(user.id, parsed.data.notificationId, parsed.data.action);
  return NextResponse.json({ updated }, { status: updated ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
}
