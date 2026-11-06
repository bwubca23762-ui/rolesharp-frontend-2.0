import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await hasAdminPermission("jobs.read"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });

  const [profiles, recentRuns, errors24h] = await Promise.all([
    q(`select jsp.*,
       (select jir.status from job_ingestion_runs jir where jir.profile_id=jsp.id order by jir.started_at desc limit 1) as last_run_status,
       (select to_char(jir.started_at, 'YYYY-MM-DD HH24:MI') from job_ingestion_runs jir where jir.profile_id=jsp.id order by jir.started_at desc limit 1) as last_run_at
       from job_search_profiles jsp order by jsp.country_code, jsp.search_term`),
    q(`select jir.*, to_char(jir.started_at,'YYYY-MM-DD HH24:MI') as started_fmt, to_char(jir.finished_at,'YYYY-MM-DD HH24:MI') as finished_fmt
       from job_ingestion_runs jir order by jir.started_at desc limit 50`),
    q(`select count(*)::text n from job_ingestion_runs where status='failed' and started_at >= now() - interval '24 hours'`),
  ]);

  return NextResponse.json({
    profiles,
    recentRuns,
    errors24h: Number(errors24h[0]?.n || 0),
    totalProfiles: profiles.length,
  });
}
