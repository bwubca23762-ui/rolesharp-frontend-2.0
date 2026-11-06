import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { pauseDailyMatchesByToken } from "@/lib/jobs-workflow/digests";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const parsed = z.object({ token: z.string().min(40).max(1000) }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_unsubscribe_token" }, { status: 400 });
  if (!(await pauseDailyMatchesByToken(parsed.data.token))) {
    return NextResponse.json({ error: "unsubscribe_token_expired_or_invalid" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, status: "paused" });
}
