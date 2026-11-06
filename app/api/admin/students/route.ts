import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { isAcademicEmail } from "@/lib/student";
import { q, withTransaction } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { boundedPage, boundedPageSize, boundedSearch, containsLikePattern } from "@/lib/sql-search";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// GET /api/admin/students — student offer management. Include verification
// requests immediately; previously Admin only showed users after they clicked
// the email link, which made legitimate pending applications invisible.
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("offers.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const query = boundedSearch(url.searchParams.get("q")).toLowerCase();
  const page = boundedPage(url.searchParams.get("page"));
  const pageSize = boundedPageSize(url.searchParams.get("pageSize"));
  const like = containsLikePattern(query);

  const where = query ? "where student_email like $1 escape '\\' or lower(coalesce(account_email,'')) like $1 escape '\\'" : "";
  const params: any[] = query ? [like] : [];

  const unified = `with latest_pending as (
      select distinct on (svt.student_email)
             svt.student_email, svt.user_id, svt.created_at, svt.expires_at,
             u.email as account_email, u.premium_until, u.premium_source
      from student_verification_tokens svt
      left join users u on u.id::text = svt.user_id
      where svt.used_at is null
        and not exists (select 1 from student_claims existing where existing.student_email = svt.student_email)
      order by svt.student_email, svt.created_at desc
    ), unified as (
      select sc.student_email, sc.user_id, sc.claimed_at, sc.claimed_at as requested_at,
             null::timestamptz as expires_at, sc.warn30_sent_at, sc.expired_sent_at,
             sc.winback_sent_at, sc.winback_opt_out,
             u.email as account_email, u.premium_until, u.premium_source,
             'claimed'::text as record_state
      from student_claims sc left join users u on u.id::text = sc.user_id
      union all
      select p.student_email, p.user_id, null::timestamptz as claimed_at, p.created_at as requested_at,
             p.expires_at, null::timestamptz as warn30_sent_at, null::timestamptz as expired_sent_at,
             null::timestamptz as winback_sent_at, false as winback_opt_out,
             p.account_email, p.premium_until, p.premium_source,
             case when p.expires_at > now() then 'pending' else 'pending_expired' end as record_state
      from latest_pending p
    )`;

  const [stats, totalRow, rows] = await Promise.all([
    q<{ total: string; active: string; expired: string; winbacks: string; optouts: string; last30: string; pending: string; pending_expired: string; applications: string }>(
      `with latest_pending as (
         select distinct on (svt.student_email) svt.student_email, svt.expires_at
         from student_verification_tokens svt
         where svt.used_at is null
           and not exists (select 1 from student_claims sc where sc.student_email = svt.student_email)
         order by svt.student_email, svt.created_at desc
       ), claim_stats as (
         select count(*)::int as total,
           count(*) filter (where u.premium_until > now() and u.premium_source = 'student')::int as active,
           count(*) filter (where u.premium_source = 'student' and (u.premium_until is null or u.premium_until <= now()))::int as expired,
           count(*) filter (where sc.winback_sent_at is not null)::int as winbacks,
           count(*) filter (where sc.winback_opt_out)::int as optouts,
           count(*) filter (where sc.claimed_at > now() - interval '30 days')::int as last30
         from student_claims sc left join users u on u.id::text = sc.user_id
       )
       select cs.total::text, cs.active::text, cs.expired::text, cs.winbacks::text,
              cs.optouts::text, cs.last30::text,
              count(*) filter (where lp.expires_at > now())::text as pending,
              count(*) filter (where lp.expires_at <= now())::text as pending_expired,
              (cs.total + count(*) filter (where lp.expires_at > now()))::text as applications
       from claim_stats cs left join latest_pending lp on true
       group by cs.total, cs.active, cs.expired, cs.winbacks, cs.optouts, cs.last30`,
    ),
    q<{ n: string }>(
      `${unified} select count(*)::text as n from unified ${where}`,
      params,
    ),
    q<any>(
      `${unified} select * from unified ${where}
       order by requested_at desc
       limit ${pageSize} offset ${(page - 1) * pageSize}`,
      params,
    ),
  ]);

  const emails = rows.map((row) => String(row.student_email));
  const signals = emails.length ? await q<{ student_email: string; grant_count: number; request_account_count: number }>(
    `with selected as (select unnest($1::text[]) student_email), latest_ip as (
       select distinct on (t.student_email) t.student_email,t.request_ip
       from student_verification_tokens t
       where t.student_email=any($1::text[]) and t.request_ip is not null
       order by t.student_email,t.created_at desc
     )
     select s.student_email,
       (select count(*)::int from student_grants g where g.student_email=s.student_email) grant_count,
       (select count(distinct t.user_id)::int from student_verification_tokens t
         where t.request_ip=i.request_ip and t.created_at>now()-interval '30 days') request_account_count
     from selected s left join latest_ip i on i.student_email=s.student_email`, [emails],
  ) : [];
  const signalByEmail = new Map(signals.map((signal) => [signal.student_email, signal]));
  return NextResponse.json({
    stats: stats[0] || {},
    total: Number(totalRow[0]?.n || 0),
    rows: rows.map((row) => ({ ...row, review: {
      academicDomainAllowed: isAcademicEmail(row.student_email),
      grantCount: signalByEmail.get(row.student_email)?.grant_count ?? 0,
      requestAccountCount: signalByEmail.get(row.student_email)?.request_account_count ?? 0,
    } })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

// POST /api/admin/students — actions on a claim.
//   { studentEmail, action: "revoke" }          → end the student premium now
//   { studentEmail, action: "extend", days }    → extend/grant student premium
//   { studentEmail, action: "release" }         → delete the claim so the email can claim again
export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("offers.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-students", 30);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { studentEmail, action, days } = body;
  const email = typeof studentEmail === "string" ? studentEmail.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "student_email_required" }, { status: 400 });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) return NextResponse.json({ error: "invalid_student_email" }, { status: 400 });

  const claim = (await q<{ student_email: string; user_id: string | null }>(
    "select student_email, user_id from student_claims where student_email = $1",
    [email],
  ))[0];
  if (!claim) return NextResponse.json({ error: "claim_not_found" }, { status: 404 });

  if (action === "revoke") {
    if (!claim.user_id) return NextResponse.json({ error: "no_linked_account" }, { status: 400 });
    await q("update users set premium_until = null where id = $1 and premium_source = 'student'", [claim.user_id]);
  } else if (action === "extend") {
    if (!claim.user_id) return NextResponse.json({ error: "no_linked_account" }, { status: 400 });
    const n = Number(days);
    if (![7, 30, 90, 180].includes(n)) return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
    // A historical student claim may now belong to a paid account. Extend
    // only the current student entitlement; never downgrade another tier.
    const extended = await q<{ id: string }>(
      `update users set premium_until=greatest(coalesce(premium_until,now()),now()) + ($2 || ' days')::interval
       where id=$1 and premium_source='student' and is_banned=false returning id`,
      [claim.user_id, String(n)],
    );
    if (!extended.length) return NextResponse.json({ error: "student_plan_not_current" }, { status: 409 });
  } else if (action === "release") {
    // Preserve the immutable grant history. Old links must not consume a new
    // grant after an operator releases this address for fresh verification.
    await withTransaction(async (query) => {
      await query(
        "update student_verification_tokens set used_at=now() where student_email=$1 and used_at is null",
        [email],
      );
      await query("delete from student_claims where student_email = $1", [email]);
    });
  } else {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  // Single audit write with staff attribution (the raw duplicate showed
  // Actor = "system" in /admin/actions).
  await recordAdminAction(`student_${action}`, {
    targetUserId: claim.user_id,
    targetEmail: email,
    details: { days: action === "extend" ? Number(days) : undefined },
  }).catch(() => {});
  return NextResponse.json({ ok: true, email, action });
}
