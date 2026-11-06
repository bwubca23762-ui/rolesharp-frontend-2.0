import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/admin/auto-mail — aggregate daily-matches and application-email stats.
// Returns campaign counts, match counts, package counts, and recent matches.
export async function GET() {
  if (!(await hasAdminPermission("jobs.read")))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [campaignStats, matchStats, packageStats, recentMatches, recentPackages] =
    await Promise.all([
      q<{
        total: string;
        active: string;
        daily_matches: string;
        role_apply: string;
        paused: string;
      }>(
        `select
           count(*)::text total,
           count(*) filter (where status = 'active')::text active,
           count(*) filter (where mode = 'daily_matches')::text daily_matches,
           count(*) filter (where mode = 'role_apply')::text role_apply,
           count(*) filter (where status = 'paused')::text paused
         from job_campaigns
         where status not in ('canceled', 'expired')`,
      ),
      q<{
        total: string;
        today: string;
        eligible: string;
        consumed: string;
        excluded: string;
      }>(
        `select
           count(*)::text total,
           count(*) filter (where created_at >= date_trunc('day', now()))::text today,
           count(*) filter (where status = 'eligible')::text eligible,
           count(*) filter (where status = 'consumed')::text consumed,
           count(*) filter (where status = 'excluded')::text excluded
         from job_matches`,
      ).catch(() => [{ total: "0", today: "0", eligible: "0", consumed: "0", excluded: "0" }]),
      q<{
        total: string;
        review_required: string;
        ready: string;
        blocked: string;
        stale: string;
      }>(
        `select
           count(*)::text total,
           count(*) filter (where status = 'review_required')::text review_required,
           count(*) filter (where status = 'ready')::text ready,
           count(*) filter (where status = 'blocked')::text blocked,
           count(*) filter (where status = 'stale')::text stale
         from application_packages`,
      ).catch(() => [{ total: "0", review_required: "0", ready: "0", blocked: "0", stale: "0" }]),
      q(
        `select m.id, m.fit_score, m.confidence_score, m.status,
                m.created_at, m.ranked_at,
                u.email,
                c.mode as campaign_mode,
                c.status as campaign_status
         from job_matches m
         left join users u on u.id = m.user_id
         left join job_campaigns c on c.id = m.campaign_id
         order by m.created_at desc
         limit 15`,
      ).catch(() => []),
      q(
        `select p.id, p.status, p.subject, p.created_at, p.updated_at,
                u.email,
                ec.provider as connection_provider,
                ec.verified_sender
         from application_packages p
         left join users u on u.id = p.user_id
         left join email_connections ec on ec.id = p.connection_id
         order by p.created_at desc
         limit 15`,
      ).catch(() => []),
    ]);

  const cs = campaignStats[0] || {};
  const ms = matchStats[0] || {};
  const ps = packageStats[0] || {};

  return NextResponse.json({
    campaigns: {
      total: Number(cs.total ?? 0),
      active: Number(cs.active ?? 0),
      dailyMatches: Number(cs.daily_matches ?? 0),
      roleApply: Number(cs.role_apply ?? 0),
      paused: Number(cs.paused ?? 0),
    },
    matches: {
      total: Number(ms.total ?? 0),
      today: Number(ms.today ?? 0),
      eligible: Number(ms.eligible ?? 0),
      consumed: Number(ms.consumed ?? 0),
      excluded: Number(ms.excluded ?? 0),
    },
    packages: {
      total: Number(ps.total ?? 0),
      reviewRequired: Number(ps.review_required ?? 0),
      ready: Number(ps.ready ?? 0),
      blocked: Number(ps.blocked ?? 0),
      stale: Number(ps.stale ?? 0),
    },
    recentMatches,
    recentPackages,
  });
}
