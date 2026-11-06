import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { listJobMatches } from "@/lib/jobs-workflow/matches";
import { workflowApiError } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  campaignId: z.string().uuid().optional(),
  status: z.enum(["eligible", "excluded", "consumed", "stale"]).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_match_query", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const result = await listJobMatches({ userId: user.id, ...parsed.data });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return workflowApiError(error, "matches_unavailable");
  }
}
