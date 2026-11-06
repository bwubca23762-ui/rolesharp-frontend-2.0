import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasDb, q, withTransaction } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { containsLikePattern } from "@/lib/sql-search";
import {
  decodeEvidence,
  INTERNSHIP_REPORT_CATEGORIES,
  INTERNSHIP_REPORT_RISKS,
  internshipReportSchema,
  safeHttpUrl,
} from "@/lib/internship-reports";

export const runtime = "nodejs";

function boundedInt(value: string | null, fallback: number, max: number) {
  return Math.min(max, Math.max(1, Number.parseInt(value || "", 10) || fallback));
}

export async function GET(req: NextRequest) {
  if (!hasDb()) return NextResponse.json({ reports: [], total: 0, page: 1, pageSize: 12 });
  const url = new URL(req.url);
  const page = boundedInt(url.searchParams.get("page"), 1, 10000);
  const pageSize = boundedInt(url.searchParams.get("pageSize"), 12, 24);
  const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const requestedRisk = url.searchParams.get("risk") || "";
  const risk = (INTERNSHIP_REPORT_RISKS as readonly string[]).includes(requestedRisk) ? requestedRisk : "";
  const requestedCategory = url.searchParams.get("category") || "";
  const category = (INTERNSHIP_REPORT_CATEGORIES as readonly string[]).includes(requestedCategory) ? requestedCategory : "";
  const user = await currentUser().catch(() => null);

  const conditions = ["r.status = 'approved'"];
  const params: unknown[] = [];
  if (search) {
    params.push(containsLikePattern(search));
    conditions.push(`(r.company ilike $${params.length} escape '\\' or r.location ilike $${params.length} escape '\\' or r.description ilike $${params.length} escape '\\')`);
  }
  if (risk) {
    params.push(risk);
    conditions.push(`r.risk = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`$${params.length} = any(r.categories)`);
  }
  const where = conditions.join(" and ");
  const totalRows = await q<{ total: string }>(`select count(*)::text as total from internship_reports r where ${where}`, params).catch(() => [{ total: "0" }]);

  const rowParams = [...params, user?.id ?? null];
  const userParam = rowParams.length;
  const rows = await q<any>(
    `select r.id, r.company, r.location, r.platform, r.risk, r.categories,
            r.description, r.created_at,
            coalesce(v.upvotes, 0)::int as upvotes,
            coalesce(v.downvotes, 0)::int as downvotes,
            coalesce(c.comments, 0)::int as comments,
            my_vote.vote::int as my_vote
     from internship_reports r
     left join lateral (
       select count(*) filter (where vote = 1) as upvotes,
              count(*) filter (where vote = -1) as downvotes
       from internship_report_votes where report_id = r.id
     ) v on true
     left join lateral (
       select count(*) as comments from internship_report_comments where report_id = r.id
     ) c on true
     left join internship_report_votes my_vote
       on my_vote.report_id = r.id and my_vote.user_id = $${userParam}::uuid
     where ${where}
     order by r.created_at desc
     limit ${pageSize} offset ${(page - 1) * pageSize}`,
    rowParams,
  ).catch(() => []);

  return NextResponse.json({ reports: rows, total: Number(totalRows[0]?.total || 0), page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "verified_email_required" }, { status: 403 });
  if (!hasDb()) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const limited = await rateLimit(req, "internship-report-submit", 5, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "too_many_reports" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 3 * 1024 * 1024) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });

  const parsed = internshipReportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_report", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const sourceUrl = safeHttpUrl(parsed.data.sourceUrl);
  if (parsed.data.sourceUrl && !sourceUrl) return NextResponse.json({ error: "invalid_source_url" }, { status: 400 });

  let evidence;
  try {
    evidence = decodeEvidence(parsed.data.evidence);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "invalid_evidence" }, { status: 400 });
  }

  let reportId: string;
  try {
    reportId = await withTransaction(async (query) => {
      const inserted = await query<{ id: string }>(
        `insert into internship_reports
         (reporter_user_id, company, location, platform, risk, categories, description, source_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [user.id, parsed.data.company, parsed.data.location, parsed.data.platform || null, parsed.data.risk,
          parsed.data.categories, parsed.data.description, sourceUrl],
      );
      const id = inserted[0].id;
      for (const file of evidence) {
        await query(
          `insert into internship_report_evidence (report_id, file_name, content_type, size_bytes, data)
           values ($1,$2,$3,$4,$5)`,
          [id, file.name, file.type, file.bytes.length, file.bytes],
        );
      }
      return id;
    });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, id: reportId, status: "pending" }, { status: 201 });
}
