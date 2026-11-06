import { q } from "../lib/db";
import { sendBulkMail, BulkBudgetExhaustedError } from "../lib/bulk-mail";
import { createCommunicationUnsubscribeToken, communicationEmailFingerprint } from "../lib/communications";
import { sellerFromEnv } from "../lib/invoice";
import { env } from "../lib/env";

// Owner-directed one-off: introduce every verified user to the full product —
// live voice interviews, AI tailoring, checkers, daily matches, salaries
// (owner decision 2026-10, recorded in the progress log). Same policy as the
// rewards announcement: BULK ONLY (Brevo free 300/day), resumable nightly,
// suppression-aware, per-user unsubscribe, postal footer. Recipients already
// mailed (or hard-bounced on this type) are skipped via email_log.
//
// Run on the VPS (or via the scheduled one-shot timer):
//   cd /opt/resume-ai/current && set -a && . /opt/resume-ai/.env && set +a
//   node --import tsx scripts/mail-platform-features.ts

const TYPE = "platform_features";
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

  const _interviewUrl = `${env.siteUrl}/interview-prep`;
  const buildUrl = `${env.siteUrl}/build`;
  const checkerUrl = `${env.siteUrl}/checker`;
  const rewardsUrl = `${env.siteUrl}/social-rewards`;

  const subject = "Live voice interviews, AI tailoring, daily job matches — your RoleSharp tour";
  const text = `Everything on RoleSharp you may not have tried yet:

• LIVE MOCK INTERVIEWS — voice coaching, real follow-up questions, premium evaluation. Follow our 3 social channels and your credits cover full premium sessions: ${rewardsUrl}
• AI RESUME TAILORING — paste one exact job; every bullet is rewritten from evidence you supplied (no invented metrics): ${buildUrl}
• ATS + LINKEDIN CHECKERS — score what recruiters' software actually reads, free: ${checkerUrl}
• DAILY JOB MATCHES — matched jobs in your inbox every morning
• REAL SALARY DATA — computed from live postings with published pay

Claim the social event for 15 days of Daily Matches plus interview credits: ${rewardsUrl}

Unsubscribe: {UNSUB}

${footer}`;
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:32px 24px;border-top:6px solid #2563eb">
    <div style="font-size:14px;font-weight:700;letter-spacing:2px;color:#64748b;margin-bottom:18px">ROLE<span style="color:#2563eb">SHARP</span></div>
    <h2 style="margin:0 0 10px;font-weight:700">Everything on RoleSharp you may not have tried</h2>
    <ul style="padding-left:18px;margin:0 0 14px">
      <li><b>Live mock interviews</b> — voice coaching, real follow-up questions, premium evaluation. <a href="${rewardsUrl}" style="color:#2563eb">Follow our 3 channels</a> and your credits cover full premium sessions.</li>
      <li><b>AI resume tailoring</b> — paste one exact job; every bullet is rewritten from evidence you supplied. No invented metrics. <a href="${buildUrl}" style="color:#2563eb">Try the builder</a>.</li>
      <li><b>ATS + LinkedIn checkers</b> — score what recruiters' software actually reads, free. <a href="${checkerUrl}" style="color:#2563eb">Check your resume</a>.</li>
      <li><b>Daily job matches</b> — matched jobs in your inbox every morning.</li>
      <li><b>Real salary data</b> — computed from live postings with published pay.</li>
    </ul>
    <p><a href="${rewardsUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">Claim 15 free days + interview credits</a></p>
    <p style="color:#64748b;font-size:12px;margin-top:28px"><a href="{UNSUB}" style="color:#64748b">Unsubscribe from product emails</a> · ${footer}</p>
  </div>`;

  let bulk = 0;
  let skipped = 0;
  for (const { email } of users) {
    if (!email || !email.includes("@")) continue;
    const token = createCommunicationUnsubscribeToken({
      fingerprint: communicationEmailFingerprint(email),
      category: "product_updates",
    });
    const unsub = `${env.siteUrl}/api/communications/unsubscribe?token=${encodeURIComponent(token)}`;
    try {
      await sendBulkMail({
        to: email,
        subject,
        text: text.replace("{UNSUB}", unsub),
        html: html.replaceAll("{UNSUB}", unsub),
        type: TYPE,
      });
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
