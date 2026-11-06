import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listJobMatches } from "@/lib/jobs-workflow/matches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20, 100));
  const result = await listJobMatches({ userId: user.id, status: "eligible", limit });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
