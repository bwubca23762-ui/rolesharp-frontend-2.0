import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listApplicationPackages } from "@/lib/jobs-workflow/packages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50, 100));
  return NextResponse.json({ packages: await listApplicationPackages(user.id, limit) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
