/**
 * Student offer lifecycle — run daily via crontab on the VPS:
 *   10 9 * * * cd /opt/resume-ai && set -a && . ./.env && set +a && npx tsx scripts/student-cron.ts >> /var/log/student-cron.log 2>&1
 *
 * Sends (each at most once per claim, tracked in student_claims):
 *   1. 30-day warning     — premium_until within the next 30 days
 *   2. expiry notice      — premium_until has passed
 *   3. win-back, 20% off  — 14+ days after expiry, unless opted out
 *
 * Expiry itself needs no action: every entitlement check compares
 * premium_until > now(), so downgrade is automatic.
 */
import { q, hasDb } from "../lib/db";
import { sendStudentWarn30Email, sendStudentExpiredEmail, sendStudentWinbackEmail } from "../lib/student";

if (!hasDb()) {
  console.error("student-cron: No DATABASE_URL configured — aborting.");
  process.exit(1);
}

type Row = { user_id: string; student_email: string; account_email: string; premium_until: string };

async function main() {
  const stamp = (field: string) => `update student_claims set ${field}=now() where user_id=$1`;

  const warn = await q<Row>(
    `select c.user_id, c.student_email, u.email account_email, u.premium_until
     from student_claims c join users u on u.id::text = c.user_id
     where u.premium_source='student' and c.warn30_sent_at is null
       and u.premium_until > now() and u.premium_until <= now() + interval '30 days'`,
  );
  for (const r of warn) {
    try {
      await sendStudentWarn30Email(r.account_email || r.student_email, new Date(r.premium_until));
      await q(stamp("warn30_sent_at"), [r.user_id]);
      console.log(`[warn30] ${r.student_email}`);
    } catch (e) { console.error(`[warn30] FAILED ${r.student_email}:`, e); }
  }

  const expired = await q<Row>(
    `select c.user_id, c.student_email, u.email account_email, u.premium_until
     from student_claims c join users u on u.id::text = c.user_id
     where u.premium_source='student' and c.expired_sent_at is null
       and u.premium_until <= now()`,
  );
  for (const r of expired) {
    try {
      await sendStudentExpiredEmail(r.account_email || r.student_email);
      await q(stamp("expired_sent_at"), [r.user_id]);
      console.log(`[expired] ${r.student_email}`);
    } catch (e) { console.error(`[expired] FAILED ${r.student_email}:`, e); }
  }

  const winback = await q<Row>(
    `select c.user_id, c.student_email, u.email account_email, u.premium_until
     from student_claims c join users u on u.id::text = c.user_id
     where u.premium_source='student' and c.winback_sent_at is null and c.winback_opt_out=false
       and c.expired_sent_at is not null
       and u.premium_until <= now() - interval '14 days'`,
  );
  for (const r of winback) {
    try {
      await sendStudentWinbackEmail(r.account_email || r.student_email, r.student_email);
      await q(stamp("winback_sent_at"), [r.user_id]);
      console.log(`[winback] ${r.student_email}`);
    } catch (e) { console.error(`[winback] FAILED ${r.student_email}:`, e); }
  }

  console.log(`student-cron done: warn30=${warn.length} expired=${expired.length} winback=${winback.length}`);
  process.exit(0);
}

main().catch((e) => { console.error("student-cron fatal:", e); process.exit(1); });
