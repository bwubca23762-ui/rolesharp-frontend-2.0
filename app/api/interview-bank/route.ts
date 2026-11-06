import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildQuestionBank } from "@/lib/interview-bank";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Query = z.object({ role: z.string().trim().regex(/^[a-z0-9-]{2,80}$/) });

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "interview-bank", 30);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });

  const parsed = Query.safeParse({ role: req.nextUrl.searchParams.get("role") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "role slug required" }, { status: 400 });

  const bank = await buildQuestionBank(parsed.data.role);
  if (!bank || bank.questions.length < 4) return NextResponse.json({ error: "no_bank" }, { status: 404 });
  return NextResponse.json(bank, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400" } });
}
