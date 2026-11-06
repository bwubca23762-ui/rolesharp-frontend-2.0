import assert from "node:assert/strict";
import { Client } from "pg";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

function assertEnvironmentFlagsOff(): void {
  for (const name of [
    "JOBS_WORKFLOWS_ENABLED",
    "ROLE_APPLY_GMAIL_SEND_ENABLED",
    "ROLE_APPLY_MICROSOFT_SEND_ENABLED",
  ]) {
    assert.equal(process.env[name] ?? "false", "false", `${name} must be false`);
  }
  if (apply) assert.equal(process.env.JOBS_ROLLBACK_RECONCILE, "true", "JOBS_ROLLBACK_RECONCILE=true is required with --apply");
}

async function main(): Promise<void> {
  assertEnvironmentFlagsOff();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const flags = await client.query<{ count: number; disabled: boolean }>(
      `select count(*)::int count,bool_and(not enabled) disabled from feature_flags
       where name in ('jobs_daily_matches','role_apply_prepare','role_apply_gmail_send','role_apply_microsoft_send')`,
    );
    assert.deepEqual(flags.rows[0], { count: 4, disabled: true }, "all four database workflow flags must be present and off");
    const before = (await client.query<{
      application_sending: number; application_pre_boundary: number;
      notification_sending: number; notification_pre_boundary: number;
    }>(`select
      (select count(*)::int from application_mail_attempts where status='sending') application_sending,
      (select count(*)::int from application_mail_attempts where status in ('queued','reserved','retryable','needs_user')) application_pre_boundary,
      (select count(*)::int from notification_outbox where status='sending') notification_sending,
      (select count(*)::int from notification_outbox where status in ('pending','claimed')) notification_pre_boundary`)).rows[0];
    assert.ok(before);
    if (!apply) {
      console.log(JSON.stringify({ mode: "inspect", before }));
      return;
    }
    await client.query("begin");
    try {
      await client.query("select pg_advisory_xact_lock(hashtext('rolesharp-jobs-rollback-reconciliation'))");
      const applicationUnknown = await client.query(
        `select complete_application_mail_invocation(
           id,current_invocation_ordinal,'unknown','rollback_reconciliation',null
         ) from application_mail_attempts where status='sending' for update`,
      );
      const applicationCanceled = await client.query(
        `update application_mail_attempts set status='canceled',provider_call_started_at=null,
           retry_not_before=null,terminal_at=now(),updated_at=now()
         where status in ('queued','reserved','retryable','needs_user') returning id`,
      );
      const notificationUnknown = await client.query(
        `select complete_notification_outbox_invocation(id,'unknown',null)
         from notification_outbox where status='sending' for update`,
      );
      const notificationCanceled = await client.query(
        `update notification_outbox set status='canceled',lease_owner=null,lease_expires_at=null,
           terminal_at=now(),purge_after=now()+interval '30 days',updated_at=now()
         where status in ('pending','claimed') returning id`,
      );
      await client.query("commit");
      console.log(JSON.stringify({
        mode: "apply",
        before,
        reconciled: {
          applicationUnknown: applicationUnknown.rowCount ?? 0,
          applicationCanceled: applicationCanceled.rowCount ?? 0,
          notificationUnknown: notificationUnknown.rowCount ?? 0,
          notificationCanceled: notificationCanceled.rowCount ?? 0,
        },
      }));
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "jobs_reconciliation_failed");
  process.exitCode = 1;
});
