import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { hasDb, q } from "@/lib/db";
import { internshipCommentSchema } from "@/lib/internship-reports";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!hasDb()) return NextResponse.json({ comments: [] });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rows = await q<any>(
    `select c.id, c.body, c.created_at
     from internship_report_comments c
     join internship_reports r on r.id = c.report_id and r.status = 'approved'
     where c.report_id = $1 order by c.created_at asc limit 200`,
    [id],
  ).catch(() => []);
  return NextResponse.json({ comments: rows.map((row) => ({ ...row, author: "Community member" })) });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "verified_email_required" }, { status: 403 });
  if (!hasDb()) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const limited = await rateLimit(req, "internship-report-comment", 12, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "too_many_comments" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = internshipCommentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_comment" }, { status: 400 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rows = await q<{ id: string; created_at: string }>(
    `insert into internship_report_comments (report_id, user_id, body)
     select $1, $2, $3 from internship_reports where id=$1 and status='approved'
     returning id, created_at`,
    [id, user.id, parsed.data.body],
  );
  if (!rows.length) return NextResponse.json({ error: "report_not_found" }, { status: 404 });
  return NextResponse.json({ comment: { ...rows[0], body: parsed.data.body, author: "Community member" } }, { status: 201 });
}
