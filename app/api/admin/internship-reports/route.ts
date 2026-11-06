import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { hasDb, q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { boundedSearch, containsLikePattern } from "@/lib/sql-search";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

const moderationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "pending"]),
  moderationNote: z.string().trim().max(1000).optional().default(""),
}).strict();

function boundedInt(value: string | null, fallback: number, max: number) {
  return Math.min(max, Math.max(1, Number.parseInt(value || "", 10) || fallback));
}
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("support.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!hasDb()) return NextResponse.json({ rows: [], total: 0, stats: {} });
  const url = new URL(req.url);
  const page = boundedInt(url.searchParams.get("page"), 1, 10000);
  const pageSize = boundedInt(url.searchParams.get("pageSize"), 20, 50);
  const search = boundedSearch(url.searchParams.get("q"));
  const statusValue = url.searchParams.get("status") || "pending";
  const status = ["pending", "approved", "rejected", "all"].includes(statusValue) ? statusValue : "pending";
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status !== "all") {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (search) {
    params.push(containsLikePattern(search));
    conditions.push(`(r.company ilike $${params.length} escape '\\' or r.location ilike $${params.length} escape '\\' or u.email ilike $${params.length} escape '\\')`);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const [stats, totalRows, rows] = await Promise.all([
    q<any>(
      `select count(*)::int as total,
              count(*) filter (where status='pending')::int as pending,
              count(*) filter (where status='approved')::int as approved,
              count(*) filter (where status='rejected')::int as rejected
       from internship_reports`,
    ),
    q<{ total: string }>(`select count(*)::text as total from internship_reports r join users u on u.id=r.reporter_user_id ${where}`, params),
    q<any>(
      `select r.id, r.company, r.location, r.platform, r.risk, r.categories, r.description,
              r.source_url, r.status, r.moderation_note, r.created_at, r.reviewed_at,
              u.email as reporter_email,
              coalesce((select json_agg(json_build_object(
                'id', e.id, 'fileName', e.file_name, 'contentType', e.content_type, 'sizeBytes', e.size_bytes
              ) order by e.created_at) from internship_report_evidence e where e.report_id=r.id), '[]'::json) as evidence,
              (select count(*)::int from internship_report_comments c where c.report_id=r.id) as comments,
              (select count(*) filter (where v.vote=1)::int from internship_report_votes v where v.report_id=r.id) as upvotes,
              (select count(*) filter (where v.vote=-1)::int from internship_report_votes v where v.report_id=r.id) as downvotes
       from internship_reports r join users u on u.id=r.reporter_user_id
       ${where} order by case when r.status='pending' then 0 else 1 end, r.created_at desc
       limit ${pageSize} offset ${(page - 1) * pageSize}`,
      params,
    ),
  ]);
  return NextResponse.json({ rows, total: Number(totalRows[0]?.total || 0), stats: stats[0] || {}, page, pageSize });
}

export async function PATCH(req: NextRequest) {
  if (!(await hasAdminPermission("support.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  if (!hasDb()) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const limited = await rateLimit(req, "admin-internship-reports", 60, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = moderationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_moderation" }, { status: 400 });
  const rows = await q<{ id: string }>(
    `update internship_reports set status=$2, moderation_note=$3, reviewed_by='admin',
            reviewed_at=case when $2='pending' then null else now() end, updated_at=now()
     where id=$1 returning id`,
    [parsed.data.id, parsed.data.status, parsed.data.moderationNote || null],
  );
  if (!rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await recordAdminAction("internship_report_moderate", { details: parsed.data });
  return NextResponse.json({ ok: true, id: parsed.data.id, status: parsed.data.status });
}

export async function DELETE(req: NextRequest) {
  if (!(await hasAdminPermission("support.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  if (!hasDb()) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const limited = await rateLimit(req, "admin-internship-report-delete", 20, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rows = await q<{ id: string }>("delete from internship_reports where id=$1 returning id", [id]);
  if (!rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await recordAdminAction("internship_report_delete", { details: { id } });
  return NextResponse.json({ ok: true });
}
