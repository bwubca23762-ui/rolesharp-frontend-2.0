import { q, withTransaction } from "../lib/db";
import {
  communicationContentDigest,
  admitCommunicationRecipients,
  estimateCommunicationAudience,
} from "../lib/communications";
import { env } from "../lib/env";

// One-shot announcement for the follow-all-channels event (owner decision
// 2026-10): create the campaign version with the exact invariants the admin
// route enforces (advisory lock, content digest, draft -> active transition),
// admit the opted-in audience, open the transport, and record the audit row.
// Run on the VPS: node --import tsx scripts/announce-social-event.ts
//
// Reach is deliberately the OPTED-IN audience only (preference_category
// product_updates): everyone else is reached by the in-product strip and the
// per-claim completion email, not by unsolicited marketing mail.

const campaignKey = "social_event_launch";
const internalName = "Follow all 3 channels — Daily Matches trial";
const subject = "15 days of Daily Matches free — follow RoleSharp on 3 channels";
const preheader = "Follow X, LinkedIn, and Instagram — activate 15 days of daily matched jobs plus interview credits.";
const textBody = `Follow RoleSharp on X, LinkedIn, and Instagram, claim each channel with your handle, and activate a ${env.daysMonthly}-day window of Daily Matches: matched jobs land in your inbox every morning. Each channel also earns an interview credit (one full premium mock interview per credit).

Claim the event: https://rolesharp.com/social-rewards

You are receiving this because you opted in to product updates. Unsubscribe any time from Settings → Notifications.`;
const htmlBody = `
  <h2 style="margin:0 0 10px;font-weight:700">Follow 3 channels → ${env.daysMonthly} days of Daily Matches, free</h2>
  <p>Follow RoleSharp on <b>X</b>, <b>LinkedIn</b>, and <b>Instagram</b>, claim each channel with your handle, and activate a ${env.daysMonthly}-day window of <b>Daily Matches</b> — matched jobs land in your inbox every morning.</p>
  <p>Each channel also earns an <b>interview credit</b> (one full premium mock interview per credit).</p>
  <p><a href="https://rolesharp.com/social-rewards" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">Claim the event</a></p>
  <p style="color:#64748b;font-size:12px">You are receiving this because you opted in to product updates. Unsubscribe any time from Settings → Notifications.</p>`;

const snapshot = {
  communicationClass: "marketing" as const,
  preferenceCategory: "product_updates" as const,
  audience: "all_verified" as const,
  subject,
  preheader,
  textBody,
  htmlBody,
  replyTo: null,
};

async function main() {
await withTransaction(async (query) => {
  await query("select pg_advisory_xact_lock(hashtext($1))", [`communication-campaign:${campaignKey}`]);
  const campaign = (
    await query<{ id: string }>(
      `insert into communication_campaigns(campaign_key,internal_name,created_by) values($1,$2,null)
       on conflict(campaign_key) do update set campaign_key=excluded.campaign_key returning id`,
      [campaignKey, internalName],
    )
  )[0];
  if (!campaign) throw new Error("communication_campaign_not_created");
  const existing = await query<{ id: string; status: string }>(
    "select id,status from communication_campaign_versions where campaign_id=$1 order by version_number desc limit 1",
    [campaign.id],
  );
  if (existing[0]) {
    console.log(`version exists: ${existing[0].id} (${existing[0].status}) — nothing to create`);
    if (existing[0].status !== "draft") return;
  }
  const version = (
    await query<{ id: string; status: string }>(
      `insert into communication_campaign_versions(campaign_id,version_number,communication_class,preference_category,audience,subject,preheader,text_body,html_body,reply_to,content_digest,created_by)
       select $1,coalesce(max(version_number),0)+1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null from communication_campaign_versions where campaign_id=$1 returning id,status`,
      [
        campaign.id,
        snapshot.communicationClass,
        snapshot.preferenceCategory,
        snapshot.audience,
        snapshot.subject,
        snapshot.preheader,
        snapshot.textBody,
        snapshot.htmlBody,
        snapshot.replyTo,
        communicationContentDigest(snapshot),
      ],
    )
  )[0];
  if (!version) throw new Error("communication_version_not_created");
  console.log("version created:", version.id);
});

const versions = await q<{ id: string; status: string }>(
  `select v.id, v.status from communication_campaign_versions v join communication_campaigns c on c.id=v.campaign_id
   where c.campaign_key=$1 order by v.version_number desc limit 1`,
  [campaignKey],
);
const version = versions[0];
if (!version) throw new Error("communication_version_missing");

if (version.status === "draft") {
  await q(
    `update communication_campaign_versions set status='active',scheduled_at=now(),
       activated_at=now(),enrollment_closed_at=now(),published_by=null
     where id=$1 and status='draft'`,
    [version.id],
  );
  console.log("version activated");
}

const estimate = await estimateCommunicationAudience(version.id);
console.log("audience estimate:", estimate);
const admitted = await admitCommunicationRecipients(version.id);
console.log("admitted recipients:", admitted.length);

await q(
  `update communication_runtime_control set transport_mode='provider', globally_paused=false, updated_at=now() where singleton=true`,
);
console.log("runtime control: transport=provider, unpaused");

await q(
  `insert into admin_actions(action,details,staff_account_id,authentication_method) values('communication_campaign_changed',$1,null,'break_glass')`,
  [JSON.stringify({ operation: "activate_now+admit", versionId: version.id, admitted: admitted.length, estimate })],
);
console.log("done");
}
main().then(() => process.exit(0)).catch((e) => { console.error("announce failed:", e instanceof Error ? e.message : e); process.exit(1); });
