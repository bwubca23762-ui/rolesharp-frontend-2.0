import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { sameOriginRequest } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";
import { q } from "@/lib/db";
import { draftForApplication, FOLLOWUP_MAX_PER_APPLICATION, FOLLOWUP_MIN_SPACING_DAYS, FOLLOWUP_QUIET_DAYS } from "@/lib/followup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Follow-up drafts for quiet applications. GET returns ready-to-copy drafts;
// POST marks one as sent (count + timestamp), re-checking the cap in SQL so a
// double-submit or a stale client cannot send a third nudge. Nothing here
// ever sends mail — the candidate copies the draft into their own mailbox.

type QuietRow = {
  id: string; company: string; role: string; updated_at: string; job_url: string | null;
  follow_up_count: number; resume_id: string | null;
  candidate_name: string | null; candidateName: string | null; content: unknown;
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const rows = await q<QuietRow>(
    `select a.id, a.company, a.role, a.updated_at, a.job_url, a.resume_id, a.follow_up_count,
            r.candidate_name, r.candidate_name as "candidateName", r.content
     from applications a
     left join resumes r on r.id = a.resume_id
     where a.user_id_text = $1
       and a.status = 'applied'
       and a.updated_at < now() - interval '${FOLLOWUP_QUIET_DAYS} days'
       and a.follow_up_count < ${FOLLOWUP_MAX_PER_APPLICATION}
       and (a.follow_up_at is null or a.follow_up_at < now() - interval '${FOLLOWUP_MIN_SPACING_DAYS} days')
     order by a.updated_at asc
     limit 20`,
    [user.id],
  );
  const drafts = rows.map((row) => draftForApplication(row, row));
  return NextResponse.json({ drafts }, { headers: { "Cache-Control": "private, no-store" } });
}

const MarkBody = z.object({ applicationId: z.string().uuid() }).strict();

export async function POST(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "followups-mark", 20);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const parsed = MarkBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const updated = await q<{ id: string }>(
    `update applications set follow_up_count = follow_up_count + 1, follow_up_at = now(), updated_at = now()
     where id = $1 and user_id_text = $2 and status = 'applied'
       and follow_up_count < ${FOLLOWUP_MAX_PER_APPLICATION}
     returning id`,
    [parsed.data.applicationId, user.id],
  );
  if (!updated[0]) return NextResponse.json({ error: "not_found_or_capped" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
