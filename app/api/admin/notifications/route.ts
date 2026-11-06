import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { q, withTransaction } from "@/lib/db";
import { canonicalJson } from "@/lib/jobs-workflow/canonical-json";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Fields = {
  internalName: z.string().trim().min(1).max(160),
  category: z.enum(["service","security","legal","product","career"]),
  preferenceCategory: z.enum(["essential","product_updates","career_tips"]),
  audience: z.enum(["all_authenticated","free","premium","student"]),
  surface: z.enum(["inbox","banner","both"]),
  severity: z.enum(["info","success","warning","critical"]),
  material: z.boolean(),
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(5000),
  ctaLabel: z.string().trim().min(1).max(100).nullable(),
  ctaUrl: z.string().trim().regex(/^\/[^/]/).max(500).nullable(),
  effectiveAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
};
const Mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), publicationKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/), ...Fields }).strict(),
  z.object({ action: z.literal("update_draft"), versionId: z.string().uuid(), ...Fields }).strict(),
  z.object({ action: z.literal("schedule"), versionId: z.string().uuid(), confirmation: z.literal("SCHEDULE NOTICE") }).strict(),
  z.object({ action: z.literal("publish_now"), versionId: z.string().uuid(), confirmation: z.literal("PUBLISH NOTICE") }).strict(),
  z.object({ action: z.literal("delete_draft"), versionId: z.string().uuid(), confirmation: z.literal("DELETE DRAFT") }).strict(),
]);

type VersionRow = {
  id: string; publication_id: string; publication_key: string; internal_name: string; version_number: number;
  status: "draft"|"scheduled"|"published"|"superseded"; category: string; preference_category: string;
  audience: string; surface: string; severity: string; material: boolean; title: string; body: string;
  cta_label: string|null; cta_url: string|null; content_digest: string; effective_at: string; expires_at: string|null;
};

function contentDigest(input: Record<string, unknown>) {
  return createHash("sha256").update(canonicalJson({ schemaVersion: 1, ...input }), "utf8").digest("hex");
}
function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "notification_management_failed";
  if ((error as { code?: string } | null)?.code === "23505") return NextResponse.json({ error: "notification_publication_conflict" }, { status: 409 });
  if (code === "staff_permission_required") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (code === "notification_version_not_found") return NextResponse.json({ error: code }, { status: 404 });
  if (code.startsWith("notification_") || code.startsWith("invalid_")) return NextResponse.json({ error: code }, { status: 400 });
  console.error("notification_management_failed", { error: code });
  return NextResponse.json({ error: "notification_management_failed" }, { status: 500 });
}
function content(data: Extract<z.infer<typeof Mutation>, { action: "create"|"update_draft" }>) {
  if ((data.ctaLabel === null) !== (data.ctaUrl === null)) throw new Error("invalid_notification_cta");
  if (data.material && (data.preferenceCategory !== "essential" || !["banner","both"].includes(data.surface))) throw new Error("invalid_material_notification");
  return { category: data.category, preferenceCategory: data.preferenceCategory, audience: data.audience, surface: data.surface,
    severity: data.severity, material: data.material, title: data.title, body: data.body, ctaLabel: data.ctaLabel, ctaUrl: data.ctaUrl };
}

export async function GET() {
  try {
    await requireAdminPermission("notifications.read");
    const versions = await q<VersionRow>(`select v.*,p.publication_key,p.internal_name from notification_publication_versions v join notification_publications p on p.id=v.publication_id order by v.effective_at desc,v.version_number desc limit 100`);
    const states = await q<{ publication_version_id: string; reached: number; read: number; dismissed: number }>(`select publication_version_id,count(*)::int reached,count(read_at)::int read,count(dismissed_at)::int dismissed from notification_user_states group by publication_version_id`);
    return NextResponse.json({ versions, states }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-notifications", 30);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = Mutation.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_notification_change" }, { status: 400 });
  try {
    const permission = ["schedule","publish_now"].includes(parsed.data.action) ? "notifications.publish" as const : "notifications.edit" as const;
    const actor = await requireAdminPermission(permission);
    const version = await withTransaction(async (query) => {
      let updated: VersionRow | null = null;
      if (parsed.data.action === "create") {
        const snapshot = content(parsed.data);
        await query("select pg_advisory_xact_lock(hashtext($1))", [`notification-publication:${parsed.data.publicationKey}`]);
        const publication = (await query<{ id: string }>(`insert into notification_publications (publication_key,internal_name,created_by) values ($1,$2,$3) on conflict (publication_key) do update set publication_key=excluded.publication_key returning id`, [parsed.data.publicationKey, parsed.data.internalName, actor.staffAccountId]))[0];
        if (!publication) throw new Error("notification_publication_not_created");
        updated = (await query<VersionRow>(`insert into notification_publication_versions (publication_id,version_number,status,category,preference_category,audience,surface,severity,material,title,body,cta_label,cta_url,content_digest,effective_at,expires_at,created_by) select $1,coalesce(max(version_number),0)+1,'draft',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15 from notification_publication_versions where publication_id=$1 returning *`, [publication.id, parsed.data.category,parsed.data.preferenceCategory,parsed.data.audience,parsed.data.surface,parsed.data.severity,parsed.data.material,parsed.data.title,parsed.data.body,parsed.data.ctaLabel,parsed.data.ctaUrl,contentDigest(snapshot),parsed.data.effectiveAt,parsed.data.expiresAt,actor.staffAccountId]))[0] ?? null;
      } else {
        const current = (await query<VersionRow>("select * from notification_publication_versions where id=$1 for update", [parsed.data.versionId]))[0];
        if (!current) throw new Error("notification_version_not_found");
        if (parsed.data.action === "update_draft") {
          if (current.status !== "draft") throw new Error("notification_version_immutable");
          const snapshot = content(parsed.data);
          await query("update notification_publications set internal_name=$2 where id=$1", [current.publication_id, parsed.data.internalName]);
          updated = (await query<VersionRow>(`update notification_publication_versions set category=$2,preference_category=$3,audience=$4,surface=$5,severity=$6,material=$7,title=$8,body=$9,cta_label=$10,cta_url=$11,content_digest=$12,effective_at=$13,expires_at=$14 where id=$1 and status='draft' returning *`, [current.id,parsed.data.category,parsed.data.preferenceCategory,parsed.data.audience,parsed.data.surface,parsed.data.severity,parsed.data.material,parsed.data.title,parsed.data.body,parsed.data.ctaLabel,parsed.data.ctaUrl,contentDigest(snapshot),parsed.data.effectiveAt,parsed.data.expiresAt]))[0] ?? null;
        } else if (parsed.data.action === "delete_draft") {
          if (current.status !== "draft") throw new Error("notification_version_immutable");
          await query("delete from notification_publication_versions where id=$1 and status='draft'", [current.id]);
        } else {
          if (current.status !== "draft") throw new Error("notification_version_immutable");
          const effectiveAt = parsed.data.action === "publish_now" ? new Date() : new Date(current.effective_at);
          if (!Number.isFinite(effectiveAt.getTime())) throw new Error("invalid_notification_effective_at");
          if (parsed.data.action === "schedule" && effectiveAt.getTime() <= Date.now()) throw new Error("notification_schedule_must_be_future");
          if (parsed.data.action === "publish_now") await query("update notification_publication_versions set status='superseded' where publication_id=$1 and status='published'", [current.publication_id]);
          updated = (await query<VersionRow>(`update notification_publication_versions set status=$2,effective_at=$3,published_at=now(),published_by=$4 where id=$1 and status='draft' returning *`, [current.id,parsed.data.action === "schedule" ? "scheduled" : "published",effectiveAt,actor.staffAccountId]))[0] ?? null;
        }
      }
      await query(`insert into admin_actions (action,details,staff_account_id,authentication_method) values ('notification_publication_changed',$1,$2,$3)`, [JSON.stringify({ operation: parsed.data.action, versionId: updated?.id ?? ("versionId" in parsed.data ? parsed.data.versionId : null), publicationKey: "publicationKey" in parsed.data ? parsed.data.publicationKey : null, status: updated?.status ?? "deleted_draft" }),actor.staffAccountId,actor.authenticationMethod]);
      return updated;
    });
    return NextResponse.json({ version }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
