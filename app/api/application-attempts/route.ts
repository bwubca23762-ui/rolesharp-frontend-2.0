import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listApplicationAttempts } from "@/lib/mail/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100, 100));
  return NextResponse.json({ attempts: await listApplicationAttempts(user.id, limit) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
