import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { communicationContentDigest, estimateCommunicationAudience, admitCommunicationRecipients } from "@/lib/communications";
import { q, withTransaction } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Fields = {
  internalName: z.string().trim().min(1).max(160),
  communicationClass: z.enum(["essential", "marketing"]),
  preferenceCategory: z.enum(["essential", "product_updates", "career_tips"]),
  audience: z.enum(["all_verified", "free", "premium", "student"]),
  subject: z.string().trim().min(1).max(180),
  preheader: z.string().trim().max(240).nullable(),
  textBody: z.string().trim().min(1).max(20000),
  htmlBody: z.string().trim().min(1).max(50000),
  replyTo: z.string().trim().email().max(320).nullable(),
};
const Mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), campaignKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/), ...Fields }).strict(),
  z.object({ action: z.literal("update_draft"), versionId: z.string().uuid(), ...Fields }).strict(),
  z.object({ action: z.literal("preview"), ...Fields }).strict(),
  z.object({ action: z.literal("test_sink"), versionId: z.string().uuid(), recipient: z.string().trim().email().regex(/@example\.test$/), confirmation: z.literal("TEST SINK") }).strict(),
  z.object({ action: z.literal("schedule"), versionId: z.string().uuid(), scheduledAt: z.string().datetime({ offset: true }), confirmation: z.literal("SCHEDULE CAMPAIGN") }).strict(),
  z.object({ action: z.literal("activate_now"), versionId: z.string().uuid(), confirmation: z.literal("ACTIVATE CAMPAIGN") }).strict(),
  z.object({ action: z.literal("pause"), versionId: z.string().uuid(), confirmation: z.literal("PAUSE CAMPAIGN") }).strict(),
  z.object({ action: z.literal("resume"), versionId: z.string().uuid(), confirmation: z.literal("RESUME CAMPAIGN") }).strict(),
  z.object({ action: z.literal("cancel"), versionId: z.string().uuid(), confirmation: z.literal("CANCEL CAMPAIGN") }).strict(),
  z.object({ action: z.literal("admit"), versionId: z.string().uuid(), confirmation: z.literal("ADMIT RECIPIENTS") }).strict(),
  z.object({ action: z.literal("delete_draft"), versionId: z.string().uuid(), confirmation: z.literal("DELETE DRAFT") }).strict(),
]);

type VersionRow = { id:string; campaign_id:string; campaign_key:string; internal_name:string; version_number:number; status:string; communication_class:"essential"|"marketing"; preference_category:"essential"|"product_updates"|"career_tips"; audience:"all_verified"|"free"|"premium"|"student"; subject:string; preheader:string|null; text_body:string; html_body:string; reply_to:string|null; content_digest:string; scheduled_at:string|null; created_at:string };

function content(data: { communicationClass:"essential"|"marketing"; preferenceCategory:"essential"|"product_updates"|"career_tips"; audience:"all_verified"|"free"|"premium"|"student"; subject:string; preheader:string|null; textBody:string; htmlBody:string; replyTo:string|null }) {
  if ((data.communicationClass === "essential") !== (data.preferenceCategory === "essential")) throw new Error("invalid_communication_preference_class");
  return { communicationClass:data.communicationClass, preferenceCategory:data.preferenceCategory, audience:data.audience, subject:data.subject, preheader:data.preheader, textBody:data.textBody, htmlBody:data.htmlBody, replyTo:data.replyTo };
}
function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "communication_management_failed";
  if ((error as { code?:string }|null)?.code === "23505") return NextResponse.json({ error:"communication_conflict" },{ status:409 });
  if (code === "staff_permission_required") return NextResponse.json({ error:"forbidden" },{ status:403 });
  if (code === "communication_version_not_found") return NextResponse.json({ error:code },{ status:404 });
  if (code.startsWith("communication_") || code.startsWith("invalid_")) return NextResponse.json({ error:code },{ status:400 });
  console.error("communication_management_failed", { error:code });
  return NextResponse.json({ error:"communication_management_failed" },{ status:500 });
}

export async function GET() {
  try {
    await requireAdminPermission("communications.read");
    const [versions,runtime,stats] = await Promise.all([
      q<VersionRow>(`select v.*,c.campaign_key,c.internal_name from communication_campaign_versions v join communication_campaigns c on c.id=v.campaign_id order by v.created_at desc,v.version_number desc limit 100`),
      q(`select transport_mode,globally_paused,max_batch_size,max_per_minute,max_per_day,updated_at from communication_runtime_control where singleton=true`),
      q(`select campaign_version_id,status,count(*)::int count from communication_recipients group by campaign_version_id,status`),
    ]);
    return NextResponse.json({ versions,runtime:runtime[0]??null,stats },{ headers:{ "Cache-Control":"private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error:"invalid_origin" },{ status:403 });
  const limited=await rateLimit(req,"admin-communications",30);
  if(!limited.ok)return NextResponse.json({error:"too_many_requests"},{status:429,headers:{"Retry-After":String(limited.retryAfter)}});
  const parsed=Mutation.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"invalid_communication_change"},{status:400});
  try {
    const change=parsed.data;
    if(change.action==="preview") {
      await requireAdminPermission("communications.edit");
      const snapshot=content(change);
      return NextResponse.json({ preview:{...snapshot,contentDigest:communicationContentDigest(snapshot)} },{headers:{"Cache-Control":"private, no-store"}});
    }
    const permission=["schedule","activate_now","pause","resume","cancel","admit"].includes(change.action)?"communications.publish" as const:"communications.edit" as const;
    const actor=await requireAdminPermission(permission);
    const result=await withTransaction(async(query)=>{
      let version:VersionRow|null=null; let admitted:number|undefined; let estimate:{eligible:number;admitted:number}|undefined;
      if(change.action==="create") {
        const snapshot=content(change);
        await query("select pg_advisory_xact_lock(hashtext($1))",[`communication-campaign:${change.campaignKey}`]);
        const campaign=(await query<{id:string}>(`insert into communication_campaigns(campaign_key,internal_name,created_by) values($1,$2,$3) on conflict(campaign_key) do update set campaign_key=excluded.campaign_key returning id`,[change.campaignKey,change.internalName,actor.staffAccountId]))[0];
        if(!campaign)throw new Error("communication_campaign_not_created");
        version=(await query<VersionRow>(`insert into communication_campaign_versions(campaign_id,version_number,communication_class,preference_category,audience,subject,preheader,text_body,html_body,reply_to,content_digest,created_by) select $1,coalesce(max(version_number),0)+1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11 from communication_campaign_versions where campaign_id=$1 returning *`,[campaign.id,snapshot.communicationClass,snapshot.preferenceCategory,snapshot.audience,snapshot.subject,snapshot.preheader,snapshot.textBody,snapshot.htmlBody,snapshot.replyTo,communicationContentDigest(snapshot),actor.staffAccountId]))[0]??null;
      } else {
        const current=(await query<VersionRow>("select * from communication_campaign_versions where id=$1 for update",[change.versionId]))[0];
        if(!current)throw new Error("communication_version_not_found");
        if(change.action==="update_draft") {
          if(current.status!=="draft")throw new Error("communication_version_immutable"); const snapshot=content(change);
          await query("update communication_campaigns set internal_name=$2 where id=$1",[current.campaign_id,change.internalName]);
          version=(await query<VersionRow>(`update communication_campaign_versions set communication_class=$2,preference_category=$3,audience=$4,subject=$5,preheader=$6,text_body=$7,html_body=$8,reply_to=$9,content_digest=$10 where id=$1 and status='draft' returning *`,[current.id,snapshot.communicationClass,snapshot.preferenceCategory,snapshot.audience,snapshot.subject,snapshot.preheader,snapshot.textBody,snapshot.htmlBody,snapshot.replyTo,communicationContentDigest(snapshot)]))[0]??null;
        } else if(change.action==="delete_draft") {
          if(current.status!=="draft")throw new Error("communication_version_immutable"); await query("delete from communication_campaign_versions where id=$1 and status='draft'",[current.id]);
        } else if(change.action==="test_sink") {
          if(current.status!=="draft")throw new Error("communication_test_requires_draft");
          version=current; estimate={eligible:1,admitted:0};
        } else if(change.action==="schedule"||change.action==="activate_now") {
          if(current.status!=="draft")throw new Error("communication_version_immutable");
          const scheduledAt=change.action==="schedule"?new Date(change.scheduledAt):new Date();
          if(!Number.isFinite(scheduledAt.getTime())||(change.action==="schedule"&&scheduledAt.getTime()<=Date.now()))throw new Error("communication_schedule_must_be_future");
          version=(await query<VersionRow>(`update communication_campaign_versions set status=$2,scheduled_at=$3,activated_at=case when $2='active' then now() end,enrollment_closed_at=case when $2='active' then now() end,published_by=$4 where id=$1 and status='draft' returning *`,[current.id,change.action==="schedule"?"scheduled":"active",scheduledAt,actor.staffAccountId]))[0]??null;
        } else if(change.action==="pause") {
          if(current.status!=="active")throw new Error("communication_campaign_not_active"); version=(await query<VersionRow>("update communication_campaign_versions set status='paused',paused_at=now() where id=$1 returning *",[current.id]))[0]??null;
        } else if(change.action==="resume") {
          if(current.status!=="paused")throw new Error("communication_campaign_not_paused"); version=(await query<VersionRow>("update communication_campaign_versions set status='active',paused_at=null where id=$1 returning *",[current.id]))[0]??null;
        } else if(change.action==="cancel") {
          if(!["scheduled","active","paused"].includes(current.status))throw new Error("communication_campaign_not_cancelable");
          version=(await query<VersionRow>("update communication_campaign_versions set status='canceled',canceled_at=now(),enrollment_closed_at=coalesce(enrollment_closed_at,now()) where id=$1 returning *",[current.id]))[0]??null;
          await query("update communication_recipients set status='canceled',terminal_at=now(),purge_after=now()+interval '30 days',lease_owner=null,lease_expires_at=null where campaign_version_id=$1 and status in ('pending','claimed')",[current.id]);
        } else if(change.action==="admit") {
          if(!["scheduled","active","paused"].includes(current.status))throw new Error("communication_campaign_not_admittable");
          estimate=await estimateCommunicationAudience(current.id,query); admitted=(await admitCommunicationRecipients(current.id,query)).length; version=current;
        }
      }
      await query(`insert into admin_actions(action,details,staff_account_id,authentication_method) values('communication_campaign_changed',$1,$2,$3)`,[JSON.stringify({operation:change.action,versionId:version?.id??("versionId" in change?change.versionId:null),status:version?.status??"deleted_draft",admitted,estimate,testRecipient:"recipient" in change?change.recipient:null}),actor.staffAccountId,actor.authenticationMethod]);
      return {version,admitted,estimate,testSink:change.action==="test_sink"?{accepted:true,transport:"local_sink",deliveryVerified:false}:undefined};
    });
    return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
  } catch(error){return errorResponse(error);}
}
