import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q, withTransaction } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { deleteAccountLifecycle } from "@/lib/account-deletion";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  ADMIN_EXPORT_PAGE_SIZE_MAX,
  boundedPageSize,
  boundedSearch,
  containsLikePattern,
} from "@/lib/sql-search";

export const runtime = "nodejs";

// GET /api/admin/users
//   ?email=x         → single-user lookup (legacy, used by Premium manager)
//   ?list=1          → paginated user table
//     &q=            → email or user ID search (ilike)
//     &plan=all|premium|paid|student|free
//       premium = any unexpired premium (paid + admin + student)
//       paid    = unexpired premium that is NOT the student offer
//       student = unexpired premium from the student offer (premium_source='student')
//     &page=1&pageSize=20 (ordinary lists capped at 100)
//     &export=csv       (explicit export mode capped at 1000)
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("users.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;

  if (sp.get("list")) {
    const search = boundedSearch(sp.get("q"));
    const plan = sp.get("plan") || "all";
    const page = Number(sp.get("page") || "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
      return NextResponse.json({ error: "invalid_page" }, { status: 400 });
    }
    const exportMode = sp.get("export") === "csv";
    const pageSize = boundedPageSize(
      sp.get("pageSize"),
      20,
      exportMode ? ADMIN_EXPORT_PAGE_SIZE_MAX : undefined,
    );
    const where: string[] = [];
    const params: any[] = [];
    if (search) {
      params.push(containsLikePattern(search));
      where.push(`(u.email ilike $${params.length} escape '\\' or u.id::text ilike $${params.length} escape '\\')`);
    }
    if (plan === "premium") where.push(`u.premium_until > now()`);
    if (plan === "paid") where.push(`u.premium_until > now() and coalesce(u.premium_source, 'paid') <> 'student'`);
    if (plan === "student") where.push(`u.premium_until > now() and u.premium_source = 'student'`);
    if (plan === "free") where.push(`coalesce(u.premium_until, 'epoch'::timestamptz) <= now()`);
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

    // Sorting has to happen in SQL, not in the client. This list is paginated
    // server-side, so sorting the twenty rows already on screen would produce a
    // table that looks ordered and is not — the worst kind of wrong, because it
    // is only detectable by paging.
    //
    // An allowlist, never interpolation: `sort` arrives from the query string
    // and is about to be concatenated into an ORDER BY, which no amount of
    // parameterisation can protect. Anything unrecognised falls back to the
    // previous default rather than erroring.
    const SORTABLE: Record<string, string> = {
      email: "u.email",
      created_at: "u.created_at",
      premium_until: "u.premium_until",
      email_verified_at: "u.email_verified_at",
      credits: "coalesce(u.credits, 0)",
      resumes: "count(r.id)",
    };
    const sortColumn = SORTABLE[sp.get("sort") ?? ""] ?? "u.created_at";
    const sortDir = sp.get("dir") === "asc" ? "asc" : "desc";
    // A stable tiebreaker, or rows with equal values can swap between pages and
    // the same account appears twice while another never appears at all.
    const orderSql = `order by ${sortColumn} ${sortDir} nulls last, u.id desc`;

    const total = Number(
      (await q<{ n: string }>(`select count(*)::int n from users u ${whereSql}`, params))[0]?.n ?? 0,
    );
    params.push(pageSize, (page - 1) * pageSize);
    const rows = await q(
      `select u.id, u.email, u.created_at, u.premium_until, u.premium_source, u.email_verified_at,
              coalesce(u.credits, 0)::int as credits,
              count(r.id)::int as resumes
       from users u
       left join resumes r on r.user_id_text = u.id::text
       ${whereSql}
       group by u.id
       ${orderSql}
       limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    return NextResponse.json({ rows, total, page, pageSize });
  }

  const email = sp.get("email")?.trim();
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const user = (await q<{
    id: string;
    email: string;
    premium_until: string | null;
    email_verified_at: string | null;
    created_at: string;
    resumes: string;
  }>(
    `select u.id, u.email, u.premium_until, u.email_verified_at, u.created_at, count(r.id)::int as resumes
     from users u
     left join resumes r on r.user_id_text = u.id::text
     where lower(u.email) = lower($1)
     group by u.id, u.email, u.premium_until, u.email_verified_at, u.created_at`,
    [email],
  ))[0];

  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    ...user,
    premium: !!user.premium_until && new Date(user.premium_until) > new Date(),
    emailVerified: !!user.email_verified_at,
    resumes: Number(user.resumes ?? 0),
  });
}

// POST /api/admin/users — row-level admin actions.
//   { email, action: "credits", delta }   → adjust credits (±1..100, floor 0)
//   { email, action: "delete" }           → permanently delete user + owned data
export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("users.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-users", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { email, action, delta } = body;
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const user = (await q<{ id: string; email: string; credits: number }>(
    "select id, email, coalesce(credits,0)::int credits from users where lower(email)=lower($1)",
    [cleanEmail],
  ))[0];
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  if (action === "credits") {
    const d = Math.trunc(Number(delta));
    if (!Number.isFinite(d) || d === 0 || Math.abs(d) > 100) {
      return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
    }
    const result = await withTransaction(async (query) => {
      const before = (await query<{ credits: number }>(
        "select coalesce(credits,0)::int credits from users where id=$1 for update", [user.id],
      ))[0];
      if (!before) throw new Error("user_not_found");
      const updated = (await query<{ credits: number }>(
        `update users set credits = greatest(0, coalesce(credits,0) + $2)
         where id=$1 returning credits::int`,
        [user.id, d],
      ))[0];
      if (!updated) throw new Error("user_not_found");
      const appliedDelta = updated.credits - before.credits;
      // ADMIN-10: the credit ledger must reflect admin adjustments too, or
      // the user's credit_events history shows unexplained jumps.
      if (appliedDelta !== 0) await query(
        `insert into credit_events (user_id, kind, delta, details)
         values ($1, 'admin_adjustment', $2, $3)`,
        [user.id, appliedDelta, JSON.stringify({ source: "admin_panel", requestedDelta: d, credits: updated.credits })],
      );
      await query(
        `insert into admin_actions (action, target_user_id, target_email, details)
         values ($1,$2,$3,$4)`,
        ["credits_adjust", user.id, user.email, JSON.stringify({ delta: appliedDelta, requestedDelta: d, credits: updated.credits })],
      );
      return { delta: appliedDelta, credits: updated.credits };
    });
    await recordAdminAction("users_action", { details: { action, email: user.email, requestedDelta: d, ...result } });
    return NextResponse.json({ ok: true, email: user.email, requestedDelta: d, ...result });
  }

  if (action === "delete") {
    const deletion = await deleteAccountLifecycle(user.id, {
      action: "user_delete",
      targetEmail: user.email,
      details: { by: "admin_panel" },
    });
    if (!deletion.deleted) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      email: user.email,
      deleted: true,
      cleanupWarnings: deletion.cleanupWarnings,
    });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
