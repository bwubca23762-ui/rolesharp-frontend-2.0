import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { hasDb, withTransaction } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
const voteSchema = z.object({ vote: z.union([z.literal(1), z.literal(-1)]) }).strict();

export async function POST(req: NextRequest, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "verified_email_required" }, { status: 403 });
  if (!hasDb()) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const limited = await rateLimit(req, "internship-report-vote", 30, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "too_many_votes" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = voteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_vote" }, { status: 400 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const result = await withTransaction(async (query) => {
    const report = await query<{ id: string }>("select id from internship_reports where id=$1 and status='approved'", [id]);
    if (!report.length) return null;
    const existing = await query<{ vote: number }>("select vote from internship_report_votes where report_id=$1 and user_id=$2", [id, user.id]);
    let myVote: number | null = parsed.data.vote;
    if (existing[0]?.vote === parsed.data.vote) {
      await query("delete from internship_report_votes where report_id=$1 and user_id=$2", [id, user.id]);
      myVote = null;
    } else {
      await query(
        `insert into internship_report_votes (report_id, user_id, vote) values ($1,$2,$3)
         on conflict (report_id, user_id) do update set vote=excluded.vote, updated_at=now()`,
        [id, user.id, parsed.data.vote],
      );
    }
    const counts = await query<{ upvotes: number; downvotes: number }>(
      `select count(*) filter (where vote=1)::int as upvotes,
              count(*) filter (where vote=-1)::int as downvotes
       from internship_report_votes where report_id=$1`,
      [id],
    );
    return { ...counts[0], myVote };
  });
  if (!result) return NextResponse.json({ error: "report_not_found" }, { status: 404 });
  return NextResponse.json(result);
}
