import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-authorization";
import {
  FEATURE_ACCESS_KEYS,
  manageFeatureAccess,
} from "@/lib/feature-access";
import { withTransaction, q } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChangeInput = z.object({
  userId: z.string().uuid(),
  featureKey: z.enum(FEATURE_ACCESS_KEYS),
  state: z.enum(["approved", "suspended", "revoked"]),
  reason: z.string().trim().min(3).max(1000),
  dailyCap: z.number().int().min(1).max(5).nullable().optional(),
  providerLimit: z.number().int().min(1).max(5).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "feature_access_management_failed";
  if (code === "staff_permission_required") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (code.endsWith("_not_found")) return NextResponse.json({ error: code }, { status: 404 });
  if (code.startsWith("feature_access_") || code.startsWith("invalid_")) {
    return NextResponse.json({ error: code }, { status: 400 });
  }
  console.error("feature_access_management_failed", { error: code });
  return NextResponse.json({ error: "feature_access_management_failed" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission("access.read");
    const state = req.nextUrl.searchParams.get("state");
    const filter = state && ["requested", "approved", "suspended", "revoked", "expired"].includes(state)
      ? state : null;
    const requestedPage = Number(req.nextUrl.searchParams.get("page") ?? 1);
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? 50);
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 ||
        !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: "invalid_pagination" }, { status: 400 });
    }
    const filterSql = filter
      ? `where (case when g.state='approved' and g.expires_at is not null and g.expires_at<=now()
          then 'expired' else g.state end)=$1`
      : "";
    const countParams = filter ? [filter] : [];
    const total = Number((await q<{ count: string | number }>(
      `select count(*)::int count from feature_access_grants g ${filterSql}`,
      countParams,
    ))[0]?.count ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const grants = await q(
      `with grant_rows as (
         select g.id,g.user_id,u.email,g.feature_key,
           case when g.state='approved' and g.expires_at is not null and g.expires_at<=now()
             then 'expired' else g.state end as effective_state,
           g.daily_cap,g.provider_limit,g.reason,g.risk_notes,g.requested_at,
           g.approved_at,g.expires_at,g.updated_at,a.email approved_by_email
         from feature_access_grants g
         join users u on u.id=g.user_id
         left join staff_accounts a on a.id=g.approved_by
       )
       select id,user_id,email,feature_key,effective_state as state,daily_cap,provider_limit,
         reason,risk_notes,requested_at,approved_at,expires_at,updated_at,approved_by_email
       from grant_rows
       where ($1::text is null or effective_state=$1)
       order by case when effective_state='requested' then 0 else 1 end,updated_at desc,id
       limit $2 offset $3`,
      [filter, pageSize, (page - 1) * pageSize],
    );
    return NextResponse.json({ grants, total, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-feature-access", 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }
  try {
    const actor = await requireAdminPermission("access.manage");
    const parsed = ChangeInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid_feature_access_change" }, { status: 400 });
    const grant = await withTransaction(async (query) => {
      const updated = await manageFeatureAccess(query, {
        userId: parsed.data.userId,
        featureKey: parsed.data.featureKey,
        actorKind: actor.breakGlass ? "break_glass" : "staff",
        actorStaffId: actor.staffAccountId,
        change: {
          state: parsed.data.state,
          reason: parsed.data.reason,
          dailyCap: parsed.data.dailyCap,
          providerLimit: parsed.data.providerLimit,
          expiresAt: typeof parsed.data.expiresAt === "string" ? new Date(parsed.data.expiresAt) : parsed.data.expiresAt,
        },
      });
      await query(
        `insert into admin_actions
           (action,target_user_id,details,staff_account_id,authentication_method)
         values ('feature_access_changed',$1,$2,$3,$4)`,
        [
          parsed.data.userId,
          JSON.stringify({
            featureKey: parsed.data.featureKey,
            state: updated.state,
            dailyCap: updated.dailyCap,
            providerLimit: updated.providerLimit,
            expiresAt: updated.expiresAt,
            reason: parsed.data.reason,
          }),
          actor.staffAccountId,
          actor.authenticationMethod,
        ],
      );
      return updated;
    });
    return NextResponse.json({ grant }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
