import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { q, withTransaction, type TransactionQuery } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";
import { STUDENT_OFFER_KEY, validateOfferTerms } from "@/lib/offers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Terms = z.object({
  schemaVersion: z.literal(1),
  eligibility: z.object({
    kind: z.literal("verified_academic_email"),
    lifetimeClaimsPerNormalizedEmail: z.literal(1),
    lifetimeClaimsPerAccount: z.literal(1),
  }).strict(),
  grant: z.object({
    kind: z.literal("premium_days"),
    days: z.number().int().min(1).max(3650),
    premiumSource: z.literal("student"),
  }).strict(),
  benefits: z.object({
    tailoredResumesPerMonth: z.number().int().min(1).max(1000),
    features: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,63}$/)).max(50),
  }).strict(),
  verification: z.object({ tokenTtlHours: z.number().int().min(1).max(168) }).strict(),
}).strict();

const DraftFields = {
  publicName: z.string().trim().min(1).max(160),
  publicSummary: z.string().trim().min(1).max(1000),
  callToAction: z.string().trim().min(1).max(120),
  terms: Terms,
  effectiveAt: z.string().datetime({ offset: true }),
  enrollmentEndsAt: z.string().datetime({ offset: true }).nullable(),
};
const Mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), offerKey: z.literal(STUDENT_OFFER_KEY), ...DraftFields }).strict(),
  z.object({ action: z.literal("update_draft"), versionId: z.string().uuid(), ...DraftFields }).strict(),
  z.object({ action: z.literal("schedule"), versionId: z.string().uuid(), confirmation: z.literal("SCHEDULE OFFER") }).strict(),
  z.object({ action: z.literal("publish_now"), versionId: z.string().uuid(), confirmation: z.literal("PUBLISH OFFER") }).strict(),
  z.object({ action: z.literal("delete_draft"), versionId: z.string().uuid(), confirmation: z.literal("DELETE DRAFT") }).strict(),
]);

type OfferVersionRow = {
  id: string;
  offer_key: string;
  title: string;
  version_number: number;
  status: "draft" | "scheduled" | "published" | "superseded";
  public_name: string;
  public_summary: string;
  call_to_action: string;
  terms_snapshot: unknown;
  content_digest: string;
  effective_at: string;
  enrollment_ends_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

async function digest(query: TransactionQuery, terms: unknown): Promise<string> {
  // The database pins offer receipts using PostgreSQL jsonb serialization.
  // JS canonical JSON differs in key order/spacing and fails the trigger.
  const row = (await query<{ digest: string }>(
    "select offer_terms_digest($1::jsonb) as digest", [JSON.stringify(terms)],
  ))[0];
  if (!row) throw new Error("offer_digest_unavailable");
  return row.digest;
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "offer_management_failed";
  if ((error as { code?: string } | null)?.code === "23505") return NextResponse.json({ error: "offer_schedule_conflict" }, { status: 409 });
  if (code === "staff_permission_required") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (code === "offer_version_not_found") return NextResponse.json({ error: code }, { status: 404 });
  if (code.startsWith("offer_") || code.startsWith("invalid_")) return NextResponse.json({ error: code }, { status: 400 });
  console.error("offer_management_failed", { error: code });
  return NextResponse.json({ error: "offer_management_failed" }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdminPermission("offers.read");
    const [versions, distribution] = await Promise.all([
      q<OfferVersionRow>(
        `select v.id,v.offer_key,d.title,v.version_number,v.status,v.public_name,v.public_summary,
           v.call_to_action,v.terms_snapshot,v.content_digest,v.effective_at,v.enrollment_ends_at,
           v.published_at,v.created_at,v.updated_at
         from offer_versions v join offer_definitions d on d.offer_key=v.offer_key
         order by v.offer_key,v.version_number desc limit 100`,
      ),
      q<{ version_number: number; claims: number; grants: number }>(
        `select v.version_number,count(distinct c.student_email)::int claims,
           count(distinct g.student_email)::int grants
         from offer_versions v
         left join student_claims c on c.offer_version_id=v.id
         left join student_grants g on g.offer_version_id=v.id
         where v.offer_key=$1 group by v.id,v.version_number order by v.version_number desc`,
        [STUDENT_OFFER_KEY],
      ),
    ]);
    return NextResponse.json({ versions, distribution }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-offers", 30);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = Mutation.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_offer_change" }, { status: 400 });

  try {
    const requiredPermission = parsed.data.action === "schedule" || parsed.data.action === "publish_now"
      ? "offers.publish" as const : "offers.edit" as const;
    const actor = await requireAdminPermission(requiredPermission);
    const version = await withTransaction(async (query) => {
      let updated: OfferVersionRow | null = null;
      if (parsed.data.action === "create") {
        const terms = validateOfferTerms(parsed.data.terms);
        await query("select pg_advisory_xact_lock(hashtext($1))", [`offer-version:${parsed.data.offerKey}`]);
        updated = (await query<OfferVersionRow>(
          `insert into offer_versions
             (offer_key,version_number,status,public_name,public_summary,call_to_action,
              terms_snapshot,content_digest,effective_at,enrollment_ends_at,created_by)
           select $1,coalesce(max(version_number),0)+1,'draft',$2,$3,$4,$5,$6,$7,$8,$9
           from offer_versions where offer_key=$1 returning *`,
          [parsed.data.offerKey, parsed.data.publicName, parsed.data.publicSummary, parsed.data.callToAction,
            terms, await digest(query, terms), parsed.data.effectiveAt, parsed.data.enrollmentEndsAt, actor.staffAccountId],
        ))[0] ?? null;
      } else {
        const current = (await query<OfferVersionRow>("select * from offer_versions where id=$1 for update", [parsed.data.versionId]))[0];
        if (!current) throw new Error("offer_version_not_found");
        if (parsed.data.action === "update_draft") {
          if (current.status !== "draft") throw new Error("offer_version_immutable");
          const terms = validateOfferTerms(parsed.data.terms);
          updated = (await query<OfferVersionRow>(
            `update offer_versions set public_name=$2,public_summary=$3,call_to_action=$4,
               terms_snapshot=$5,content_digest=$6,effective_at=$7,enrollment_ends_at=$8,updated_at=now()
             where id=$1 and status='draft' returning *`,
            [current.id, parsed.data.publicName, parsed.data.publicSummary, parsed.data.callToAction,
              terms, await digest(query, terms), parsed.data.effectiveAt, parsed.data.enrollmentEndsAt],
          ))[0] ?? null;
        } else if (parsed.data.action === "delete_draft") {
          if (current.status !== "draft") throw new Error("offer_version_immutable");
          await query("delete from offer_versions where id=$1 and status='draft'", [current.id]);
        } else {
          if (current.status !== "draft") throw new Error("offer_version_immutable");
          const effectiveAt = parsed.data.action === "publish_now" ? new Date() : new Date(current.effective_at);
          if (!Number.isFinite(effectiveAt.getTime())) throw new Error("invalid_offer_effective_at");
          if (parsed.data.action === "schedule" && effectiveAt.getTime() <= Date.now()) throw new Error("offer_schedule_must_be_future");
          if (parsed.data.action === "schedule") {
            const conflict = (await query<{ id: string }>(
              `select id from offer_versions
               where offer_key=$1 and status='scheduled' and effective_at=$2 and id<>$3 limit 1`,
              [current.offer_key, effectiveAt, current.id],
            ))[0];
            if (conflict) throw new Error("offer_schedule_conflict");
          }
          if (parsed.data.action === "publish_now") {
            await query("update offer_versions set status='superseded',updated_at=now() where offer_key=$1 and status='published'", [current.offer_key]);
            await query(
              `update offer_versions set status='superseded',updated_at=now()
               where offer_key=$1 and status='scheduled' and id<>$2 and effective_at<=$3`,
              [current.offer_key, current.id, effectiveAt],
            );
          }
          updated = (await query<OfferVersionRow>(
            `update offer_versions set status=$2,effective_at=$3,published_at=now(),published_by=$4,updated_at=now()
             where id=$1 and status='draft' returning *`,
            [current.id, parsed.data.action === "schedule" ? "scheduled" : "published", effectiveAt, actor.staffAccountId],
          ))[0] ?? null;
        }
      }
      await query(
        `insert into admin_actions (action,details,staff_account_id,authentication_method)
         values ('offer_version_changed',$1,$2,$3)`,
        [JSON.stringify({ operation: parsed.data.action, versionId: updated?.id ?? ("versionId" in parsed.data ? parsed.data.versionId : null),
          offerKey: updated?.offer_key ?? ("offerKey" in parsed.data ? parsed.data.offerKey : null),
          versionNumber: updated?.version_number ?? null, status: updated?.status ?? "deleted_draft" }),
          actor.staffAccountId, actor.authenticationMethod],
      );
      return updated;
    });
    return NextResponse.json({ version }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
