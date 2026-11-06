import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { communicationEmailFingerprint, estimateCommunicationAudience, recoverExpiredCommunicationClaims } from "@/lib/communications";
import { q, withTransaction } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Filters = z.object({
  status: z.enum(["all", "pending", "claimed", "sending", "provider_accepted", "failed", "unknown", "suppressed", "canceled"]),
  email: z.union([z.literal(""), z.string().email().max(320)]),
  versionId: z.union([z.literal(""), z.string().uuid()]),
});

function failure(error: unknown) {
  if (error instanceof Error && error.message === "staff_permission_required") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  console.error("communication_inspector_failed", { name: error instanceof Error ? error.name : "unknown", code: error && typeof error === "object" && "code" in error ? String(error.code) : null });
  return NextResponse.json({ error: "communication_inspector_failed" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission("communications.read");
    const parsed = Filters.safeParse({ status: req.nextUrl.searchParams.get("status") ?? "all", email: (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase(), versionId: req.nextUrl.searchParams.get("versionId") ?? "" });
    if (!parsed.success) return NextResponse.json({ error: "invalid_inspector_filter" }, { status: 400 });
    const fingerprint = parsed.data.email ? communicationEmailFingerprint(parsed.data.email) : null;
    const versionId = parsed.data.versionId || null;
    const [recipients, suppressions, stats, estimate] = await Promise.all([
      q(`select r.id,r.campaign_version_id,r.recipient_email,r.status,r.created_at,r.updated_at,
            r.lease_expires_at,v.subject,c.campaign_key,a.transport,a.provider_category
         from communication_recipients r
         join communication_campaign_versions v on v.id=r.campaign_version_id
         join communication_campaigns c on c.id=v.campaign_id
         left join communication_attempts a on a.recipient_id=r.id
         where ($1::text='all' or r.status=$1) and ($2::text is null or r.email_fingerprint=$2)
           and ($3::uuid is null or r.campaign_version_id=$3)
         order by r.created_at desc,r.id desc limit 50`, [parsed.data.status, fingerprint, versionId]),
      q(`select id,email_fingerprint,scope,reason,created_at from communication_suppressions
         where ($1::text is null or email_fingerprint=$1) order by created_at desc,id desc limit 50`, [fingerprint]),
      q(`select status,count(*)::int count from communication_recipients group by status`),
      versionId ? estimateCommunicationAudience(versionId) : Promise.resolve(null),
    ]);
    return NextResponse.json({ recipients, suppressions, stats, estimate }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

// A provider attempt has a unique recipient constraint. Never reset failed or
// ambiguous sends: only leases that expired BEFORE that boundary are recoverable.
export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const actor = await requireAdminPermission("communications.publish");
    const limited = await rateLimit(req, "admin-communications-recover", 5);
    if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
    const parsed = z.object({ confirmation: z.literal("RECOVER CLAIMS") }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid_confirmation" }, { status: 400 });
    const recovered = await withTransaction(async (query) => {
      const count = await recoverExpiredCommunicationClaims(query);
      await query(`insert into admin_actions(action,details,staff_account_id,authentication_method)
        values('communication_claims_recovered',$1,$2,$3)`, [JSON.stringify({ count }), actor.staffAccountId, actor.authenticationMethod]);
      return count;
    });
    return NextResponse.json({ recovered }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
