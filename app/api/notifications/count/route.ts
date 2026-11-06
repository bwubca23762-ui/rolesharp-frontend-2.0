import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { currentMaterialBanner, unreadNotificationCount } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const context = { userId: user.id, premium: user.premium, premiumSource: user.premiumSource };
  const [unreadCount, banner] = await Promise.all([
    unreadNotificationCount(context),
    currentMaterialBanner(context),
  ]);
  return NextResponse.json({ unreadCount, banner }, { headers: { "Cache-Control": "private, no-store" } });
}
