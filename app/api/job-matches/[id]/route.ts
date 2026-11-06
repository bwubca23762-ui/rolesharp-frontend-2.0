import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getJobMatch } from "@/lib/jobs-workflow/matches";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "invalid_match_id" }, { status: 400 });
  const match = await getJobMatch(user.id, id.data);
  if (!match) return NextResponse.json({ error: "match_not_found" }, { status: 404 });
  return NextResponse.json({ match }, { headers: { "Cache-Control": "private, no-store" } });
}
