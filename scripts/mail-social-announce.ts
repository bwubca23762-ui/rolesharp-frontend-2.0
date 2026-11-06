import { q } from "../lib/db";
import { sendBulkMail, BulkBudgetExhaustedError } from "../lib/bulk-mail";
import { createCommunicationUnsubscribeToken, communicationEmailFingerprint } from "../lib/communications";
import { sellerFromEnv } from "../lib/invoice";
import { env } from "../lib/env";

// Owner-directed one-off announcement of the follow-all-channels event to
// every verified user (owner decision 2026-10, recorded in the progress log).
// Transport policy per owner: BULK ONLY — the Brevo free slot (300/day,
// DKIM-authenticated domain). No transactional fallback: when the pool is
// exhausted the run ends and the scheduled resume picks up the remainder the
// next UTC day. Compliance furniture: working per-user unsubscribe, postal
// footer, suppression respect, and every send marked in email_log with type
// social_event so re-runs skip recipients already mailed (or hard-bounced).
//
// Run on the VPS (or via the scheduled one-shot timer):
//   cd /opt/resume-ai/current && set -a && . /opt/resume-ai/.env && set +a
//   node --import tsx scripts/mail-social-announce.ts

const TYPE = "social_event";
const SLEEP_MS = 350;

async function main() {
  const seller = sellerFromEnv();
  const address = seller.addressLines.join(", ");
  const footer = address ? `${seller.name} · ${address}` : seller.name;
  const fingerprintKey = process.env.COMMUNICATIONS_UNSUBSCRIBE_KEY ?? process.env.AUTH_SECRET ?? "";

  const users = await q<{ email: string }>(
    `select distinct lower(u.email) as email
     from users u
     where u.email_verified_at is not null
       and u.is_banned = false
       and u.deleting_at is null
       and u.email is not null
       and length(trim(u.email)) > 3
       and not exists (
         select 1 from communication_suppressions s
         where s.email_fingerprint = encode(hmac(lower(u.email), $1, 'sha256'), 'hex')
           and s.scope in ('all', 'marketing', 'product_updates')
       )
       and not exists (
         select 1 from email_log e
         where e.recipient = lower(u.email) and e.type = $2 and e.status in ('queued', 'sent')
       )
       and not exists (
         select 1 from email_log e
         where e.recipient = lower(u.email) and e.type = $2
           and e.transport like 'bulk:%' and e.status = 'failed'
       )
     order by 1 asc`,
    [fingerprintKey, TYPE],
  );
  console.log(`recipients to mail: ${users.length}`);

  let bulk = 0;
  let skipped = 0;
  for (const { email } of users) {
    if (!email || !email.includes("@")) continue;
    const token = createCommunicationUnsubscribeToken({
      fingerprint: communicationEmailFingerprint(email),
      category: "product_updates",
    });
    const unsub = `${env.siteUrl}/api/communications/unsubscribe?token=${encodeURIComponent(token)}`;
    const cta = `${env.siteUrl}/social-rewards`;
    const subject = "Follow RoleSharp on 3 channels — get 15 days of Daily Matches free";
    const text = `Follow RoleSharp on X, LinkedIn, and Instagram, claim each channel with your handle, and activate 15 days of Daily Matches — matched jobs land in your inbox every morning. Each channel also earns an interview credit (a full premium mock interview per credit).\n\nClaim it: ${cta}\n\nUnsubscribe: ${unsub}\n\n${footer}`;
    const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:32px 24px;border-top:6px solid #2563eb">
    <div style="font-size:14px;font-weight:700;letter-spacing:2px;color:#64748b;margin-bottom:18px">ROLE<span style="color:#2563eb">SHARP</span></div>
    <h2 style="margin:0 0 10px;font-weight:700">Follow 3 channels → 15 days of Daily Matches, free</h2>
    <p>Follow RoleSharp on <b>X</b>, <b>LinkedIn</b>, and <b>Instagram</b>, claim each channel with your handle, and activate a 15-day window of <b>Daily Matches</b> — matched jobs land in your inbox every morning.</p>
    <p>Each channel also earns an <b>interview credit</b> — one full premium mock interview per credit.</p>
    <p><a href="${cta}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">Claim the event</a></p>
    <p style="color:#64748b;font-size:12px;margin-top:28px"><a href="${unsub}" style="color:#64748b">Unsubscribe from product emails</a> · ${footer}</p>
  </div>`;

    try {
      await sendBulkMail({ to: email, subject, text, html, type: TYPE });
      bulk++;
    } catch (error) {
      if (error instanceof BulkBudgetExhaustedError) {
        console.log("bulk pool exhausted — ending this run; the scheduled resume continues next UTC day");
        break;
      }
      skipped++;
      console.error(`bulk send failed for ${email}:`, error instanceof Error ? error.message : error);
    }
    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
  console.log(`done — bulk: ${bulk}, failed-skipped: ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("announce failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
