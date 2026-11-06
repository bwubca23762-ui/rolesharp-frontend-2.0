import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { q, withTransaction } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DocumentKey = z.enum(["terms", "privacy"]);
const Mutation = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    documentKey: DocumentKey,
    bodyMarkdown: z.string().min(20).max(200_000),
    changeSummary: z.string().trim().min(3).max(2_000),
    materialChange: z.boolean(),
    effectiveAt: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({
    action: z.literal("update_draft"),
    versionId: z.string().uuid(),
    bodyMarkdown: z.string().min(20).max(200_000),
    changeSummary: z.string().trim().min(3).max(2_000),
    materialChange: z.boolean(),
    effectiveAt: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({
    action: z.literal("schedule"),
    versionId: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal("publish_now"),
    versionId: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal("delete_draft"),
    versionId: z.string().uuid(),
  }).strict(),
]);

type LegalVersionRow = {
  id: string;
  document_key: "terms" | "privacy";
  title: string;
  version_number: number;
  status: "draft" | "scheduled" | "published" | "superseded";
  body_markdown: string;
  change_summary: string;
  material_change: boolean;
  effective_at: string;
  published_at: string | null;
  content_digest: string;
  created_at: string;
  updated_at: string;
  acceptance_count: number;
};

function digest(body: string) {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "legal_management_failed";
  if (code === "staff_permission_required") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (code === "legal_version_not_found") return NextResponse.json({ error: code }, { status: 404 });
  if (code.startsWith("legal_") || code.startsWith("invalid_")) {
    return NextResponse.json({ error: code }, { status: 400 });
  }
  console.error("legal_management_failed", { error: code });
  return NextResponse.json({ error: "legal_management_failed" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission("legal.read");
    const parsedKey = DocumentKey.safeParse(req.nextUrl.searchParams.get("document"));
    const documentKey = parsedKey.success ? parsedKey.data : null;
    const versions = await q<LegalVersionRow>(
      `select v.id,v.document_key,d.title,v.version_number,v.status,v.body_markdown,
         v.change_summary,v.material_change,v.effective_at,v.published_at,v.content_digest,
         v.created_at,v.updated_at,
         (select count(*)::int from legal_acceptances a where a.legal_version_id=v.id) acceptance_count
       from legal_document_versions v
       join legal_documents d on d.document_key=v.document_key
       where ($1::text is null or v.document_key=$1)
       order by v.document_key,v.version_number desc
       limit 100`,
      [documentKey],
    );
    return NextResponse.json({ versions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-legal", 30);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }
  const parsed = Mutation.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_legal_change" }, { status: 400 });
  try {
    const requiredPermission = parsed.data.action === "schedule" || parsed.data.action === "publish_now"
      ? "legal.publish" as const : "legal.edit" as const;
    const actor = await requireAdminPermission(requiredPermission);
    const version = await withTransaction(async (query) => {
      let updated: LegalVersionRow | null = null;
      if (parsed.data.action === "create") {
        const body = parsed.data.bodyMarkdown.trim();
        await query("select pg_advisory_xact_lock(hashtext($1))", [`legal-version:${parsed.data.documentKey}`]);
        updated = (await query<LegalVersionRow>(
          `insert into legal_document_versions
             (document_key,version_number,status,body_markdown,change_summary,material_change,
              effective_at,created_by,content_digest)
           select $1,coalesce(max(version_number),0)+1,'draft',$2,$3,$4,$5,$6,$7
           from legal_document_versions where document_key=$1
           returning *`,
          [parsed.data.documentKey, body, parsed.data.changeSummary, parsed.data.materialChange,
            parsed.data.effectiveAt, actor.staffAccountId, digest(body)],
        ))[0] ?? null;
      } else {
        const current = (await query<LegalVersionRow>(
          "select * from legal_document_versions where id=$1 for update",
          [parsed.data.versionId],
        ))[0];
        if (!current) throw new Error("legal_version_not_found");
        if (parsed.data.action === "update_draft") {
          if (current.status !== "draft") throw new Error("legal_version_immutable");
          const body = parsed.data.bodyMarkdown.trim();
          updated = (await query<LegalVersionRow>(
            `update legal_document_versions set body_markdown=$2,change_summary=$3,material_change=$4,
               effective_at=$5,content_digest=$6,updated_at=now()
             where id=$1 and status='draft' returning *`,
            [current.id, body, parsed.data.changeSummary, parsed.data.materialChange,
              parsed.data.effectiveAt, digest(body)],
          ))[0] ?? null;
        } else if (parsed.data.action === "delete_draft") {
          if (current.status !== "draft") throw new Error("legal_version_immutable");
          await query("delete from legal_document_versions where id=$1 and status='draft'", [current.id]);
        } else {
          if (current.status !== "draft") throw new Error("legal_version_immutable");
          const effectiveAt = parsed.data.action === "publish_now" ? new Date() : new Date(current.effective_at);
          if (!Number.isFinite(effectiveAt.getTime())) throw new Error("invalid_legal_effective_at");
          if (parsed.data.action === "schedule" && effectiveAt.getTime() <= Date.now()) {
            throw new Error("legal_schedule_must_be_future");
          }
          if (parsed.data.action === "publish_now") {
            await query(
              `update legal_document_versions set status='superseded',updated_at=now()
               where document_key=$1 and status='published'`,
              [current.document_key],
            );
          }
          updated = (await query<LegalVersionRow>(
            `update legal_document_versions set status=$2,effective_at=$3,published_at=now(),
               published_by=$4,updated_at=now()
             where id=$1 and status='draft' returning *`,
            [current.id, parsed.data.action === "schedule" ? "scheduled" : "published",
              effectiveAt, actor.staffAccountId],
          ))[0] ?? null;
        }
      }
      await query(
        `insert into admin_actions (action,details,staff_account_id,authentication_method)
         values ('legal_version_changed',$1,$2,$3)`,
        [JSON.stringify({ operation: parsed.data.action, versionId: updated?.id ?? ("versionId" in parsed.data ? parsed.data.versionId : null),
          documentKey: updated?.document_key ?? ("documentKey" in parsed.data ? parsed.data.documentKey : null),
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
