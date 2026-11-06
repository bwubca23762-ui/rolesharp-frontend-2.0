import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { deleteResumeAsAdmin, q } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { boundedPageSize, boundedSearch, containsLikePattern } from "@/lib/sql-search";

// deleteResumeAsAdmin writes the matching admin_actions row in the same
// PostgreSQL transaction as the resume and package-graph deletion.

export const runtime = "nodejs";

// GET /api/admin/resumes?q=&page=&pageSize= — paginated resume table with
// owner email, target company/role, ATS score, and generation time.
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("users.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const search = boundedSearch(sp.get("q"));
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = boundedPageSize(sp.get("pageSize"));

  const params: any[] = [];
  let whereSql = "";
  if (search) {
    params.push(containsLikePattern(search));
    whereSql = `where (r.candidate_name ilike $1 escape '\\' or u.email ilike $1 escape '\\' or c.name ilike $1 escape '\\' or ro.title ilike $1 escape '\\')`;
  }

  const total = Number(
    (await q<{ n: string }>(
      `select count(*)::int n
       from resumes r
       left join users u on r.user_id_text = u.id::text
       left join companies c on c.id = r.company_id
       left join roles ro on ro.id = r.role_id
       ${whereSql}`,
      params,
    ))[0]?.n ?? 0,
  );

  params.push(pageSize, (page - 1) * pageSize);
  const rows = await q(
    `select r.id, r.candidate_name, r.ats_score, r.gen_ms, r.template, r.created_at,
            u.email, c.name as company, ro.title as role,
            case when coalesce(length(r.jd_text),0) > 0 then true else false end as has_jd
     from resumes r
     left join users u on r.user_id_text = u.id::text
     left join companies c on c.id = r.company_id
     left join roles ro on ro.id = r.role_id
     ${whereSql}
     order by r.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  return NextResponse.json({ rows, total, page, pageSize });
}

// DELETE /api/admin/resumes?id= — remove a single resume (moderation / GDPR).
export async function DELETE(req: NextRequest) {
  if (!(await hasAdminPermission("users.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const deleted = await deleteResumeAsAdmin(id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
