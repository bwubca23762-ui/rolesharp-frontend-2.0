import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";

const Event = z.object({
  matchId: z.string().uuid(),
  eventType: z.enum(["shown", "opened", "dismissed", "saved", "manual_applied", "approved_email", "interview"]),
}).strict();

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const parsed = Event.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_match_event" }, { status: 400 });
  const recorded = await withTransaction(async (query) => {
    const match = (await query<any>(
      `select id,user_id,canonical_job_key,score_version,fit_score,confidence_score,breakdown,
         provenance,blockers,created_at from job_matches where id=$1 and user_id=$2 for key share`,
      [parsed.data.matchId, user.id],
    ))[0];
    if (!match) return false;
    const shown = parsed.data.eventType === "shown" ? null : (await query<{ impression_at: string }>(
      `select impression_at from job_match_calibration_events
       where user_id=$1 and job_match_id=$2 and event_type='shown'
       order by impression_at desc limit 1`, [user.id, match.id],
    ))[0];
    if (parsed.data.eventType !== "shown" && !shown) return false;
    const now = new Date();
    const signalSnapshot = (Array.isArray(match.breakdown?.signals) ? match.breakdown.signals : []).map((signal: any) => ({
      signal: signal.signal, weightBasisPoints: signal.weightBasisPoints,
      matchBasisPoints: signal.matchBasisPoints, reliabilityBasisPoints: signal.reliabilityBasisPoints,
    }));
    await query(
      `insert into job_match_calibration_events(user_id,job_match_id,canonical_job_key,score_version,
         event_type,fit_score,confidence_score,hard_blocked,signal_snapshot,feature_versions,
         impression_at,occurred_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [user.id, match.id, match.canonical_job_key, match.score_version, parsed.data.eventType,
        match.fit_score, match.confidence_score, Array.isArray(match.blockers) && match.blockers.length > 0,
        JSON.stringify(signalSnapshot), match.provenance ?? {}, shown?.impression_at ?? now, now],
    );
    return true;
  });
  if (!recorded) return NextResponse.json({ error: "match_or_impression_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
