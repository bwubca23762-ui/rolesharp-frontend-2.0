import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { StaffAuthorizationError } from "@/lib/staff-auth";
import { q, withTransaction } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";
import { reviewSocialRewardClaim, socialRewardConfig } from "@/lib/social-rewards";
import { boundedPage } from "@/lib/sql-search";
import { z } from "zod";

export const runtime = "nodejs";

// Admin control for the social follow rewards campaign: active toggle and
// the per-platform credit amount (the owner's "decide later in admin").
export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission("payments.read");
  const config = await socialRewardConfig();
  const claims = await q<{ platform: string; count: number }>(
    "select platform, count(*)::int as count from social_reward_claims group by platform",
  );
  const status = req.nextUrl.searchParams.get("status") ?? "all";
  if (!["all", "pending", "approved", "rejected"].includes(status)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  const page = boundedPage(req.nextUrl.searchParams.get("page"));
  const recent = await q(
    `select c.id,u.email, c.platform, c.handle, c.created_at, c.follow_attested_at,c.review_status,c.requested_credits,c.credits_awarded,c.review_note
     from social_reward_claims c join users u on u.id = c.user_id
     where ($1='all' or c.review_status=$1)
     order by case when c.review_status='pending' then 0 else 1 end,c.created_at desc,c.id desc limit 20 offset $2`, [status, (page - 1) * 20],
  );
  const total = (await q<{ n: number }>("select count(*)::int n from social_reward_claims where ($1='all' or review_status=$1)", [status]))[0]?.n ?? 0;
  return NextResponse.json({ config, claims, recent, total, page }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof StaffAuthorizationError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: "admin_request_failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-social-rewards", 20);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  let actor;
  try {
    actor = await requireAdminPermission("payments.manage");
  } catch (error) {
    if (error instanceof StaffAuthorizationError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: "admin_request_failed" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.active !== "boolean") return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  const active = body.active;
  if (body.reviewRequired !== undefined && typeof body.reviewRequired !== "boolean") return NextResponse.json({ error: "reviewRequired must be a boolean" }, { status: 400 });
  const credits = body.creditsPerPlatform;
  if (!Number.isInteger(credits) || credits < 0 || credits > 100) {
    return NextResponse.json({ error: "credits_per_platform must be an integer between 0 and 100" }, { status: 400 });
  }
  const dailyMatchesDays = body.dailyMatchesDays === undefined ? 15 : body.dailyMatchesDays;
  if (!Number.isInteger(dailyMatchesDays) || dailyMatchesDays < 0 || dailyMatchesDays > 365) {
    return NextResponse.json({ error: "dailyMatchesDays must be an integer between 0 and 365" }, { status: 400 });
  }
  try {
  await withTransaction(async (query) => {
  await query(
    "update social_reward_config set active=$1, credits_per_platform=$2, premium_bonus_days=$3, review_required=coalesce($4,review_required),updated_at=now() where id=true",
    [active, credits, dailyMatchesDays, body.reviewRequired ?? null],
  );
  await query(
    "insert into admin_actions(action,details,staff_account_id,authentication_method) values('social_rewards_config',$1,$2,$3)",
    [JSON.stringify({ active, creditsPerPlatform: credits, dailyMatchesDays, reviewRequired: body.reviewRequired }), actor.staffAccountId, actor.authenticationMethod],
  );
  });
  const config = await socialRewardConfig();
  return NextResponse.json({ ok: true, config, actor: actor.email });
  } catch {
    return NextResponse.json({ error: "admin_request_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const actor = await requireAdminPermission("payments.manage");
    const limited = await rateLimit(req, "admin-social-review", 30);
    if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
    const parsed = z.object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), action: z.enum(["approve", "reject"]), note: z.string().trim().max(1000).default("") }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success || (parsed.data.action === "reject" && parsed.data.note.length < 3)) return NextResponse.json({ error: "invalid_review_or_missing_reason" }, { status: 400 });
    return NextResponse.json(await reviewSocialRewardClaim(parsed.data.id, parsed.data.action, parsed.data.note, actor));
  } catch (error) {
    if (error instanceof StaffAuthorizationError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const code = error instanceof Error ? error.message : "review_failed";
    if (code === "claim_not_found") return NextResponse.json({ error: code }, { status: 404 });
    if (code === "claim_account_ineligible" || code === "invalid_claim_reward") return NextResponse.json({ error: code }, { status: 409 });
    return NextResponse.json({ error: "review_failed" }, { status: 500 });
  }
}
