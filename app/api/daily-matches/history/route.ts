import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listDailyDigestHistory } from "@/lib/jobs-workflow/digests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  return NextResponse.json({ digests: await listDailyDigestHistory(user.id) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
