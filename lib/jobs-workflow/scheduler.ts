import { q } from "../db";
import { recoverStuckSends } from "./stuck-send-recovery";
import { workflowFlagEnabled } from "./flags";
import {
  enqueueBlogGeneration,
  enqueueMailboxAttempt,
  enqueueNotificationOutbox,
  enqueueWorkflowItem,
  type JobsWorkflowQueueName,
} from "./queues";

type ScheduledRow = { id: string; kind: "jobs_match" | "jobs_digest" | "application_package" };

function queueFor(kind: ScheduledRow["kind"]): JobsWorkflowQueueName {
  if (kind === "jobs_match") return "jobs-match";
  if (kind === "jobs_digest") return "jobs-digest";
  return "application-package";
}

export async function scheduleDueWorkflowItems(
  now = new Date(),
  enqueueWorkflow: (queue: JobsWorkflowQueueName, payload: { workItemId: string; version: 1 }) => Promise<unknown> = enqueueWorkflowItem,
  enqueueMailbox: (payload: { attemptId: string; version: 1 }, ordinal: number) => Promise<unknown> = enqueueMailboxAttempt,
  enqueueNotification: (payload: { outboxId: string; version: 1 }) => Promise<unknown> = enqueueNotificationOutbox,
  enqueueBlog: (payload: { generationJobId: string; version: 1 }) => Promise<unknown> = enqueueBlogGeneration,
): Promise<number> {
  // Before claiming new work, resolve anything a dead worker abandoned mid-send.
  // The selects below only ever look at `pending` and lease-expired `claimed`,
  // so a row stranded in `sending` is invisible to this scheduler forever — and
  // for communications it also permanently blocks that recipient. Failing to
  // recover must not stop the tick: new work is still worth scheduling.
  await recoverStuckSends().catch((error: unknown) => {
    console.error("[stuck-send-recovery] failed:", error instanceof Error ? error.message : error);
  });

  const [dailyEnabled, applyEnabled, blogRows] = await Promise.all([
    workflowFlagEnabled("jobs_daily_matches"),
    workflowFlagEnabled("role_apply_prepare"),
    q<{ id: string }>(
      `select id from blog_generation_jobs
       where (status='pending' and available_at<=now())
          or (status='running' and lease_expires_at<=now())
       order by available_at,created_at limit 50`,
    ),
  ]);
  await Promise.all(blogRows.map((job) => enqueueBlog({ generationJobId: job.id, version: 1 })));
  if (!dailyEnabled && !applyEnabled) return blogRows.length;
  await q(
    `update job_campaigns set timezone=pending_timezone,
       timezone_generation=pending_timezone_generation,pending_timezone=null,
       pending_timezone_generation=null,next_timezone_activation_date=null,updated_at=now()
     where pending_timezone is not null
       and ($1 at time zone timezone)::date>=next_timezone_activation_date`, [now],
  );
  const rows = await q<ScheduledRow>(
    `with due as (
       select c.id,c.user_id,c.mode,(($1 at time zone c.timezone)::date)::text local_date
       from job_campaigns c join users u on u.id=c.user_id and u.deleting_at is null
       join feature_access_grants g on g.user_id=c.user_id
         and g.feature_key=case when c.mode='daily_matches' then 'daily_matches' else 'role_apply_prepare' end
         and g.state='approved' and (g.expires_at is null or g.expires_at>now())
       where c.status='active'
         and (($1 at time zone c.timezone)::time >= c.daily_time)
         and ((c.mode='daily_matches' and $2) or (c.mode='role_apply' and $3))
     )
     insert into job_work_items(user_id,kind,aggregate_id,dedupe_key,available_at)
       select user_id,'jobs_match',id,id::text||':'||local_date||':match',$1 from due
     on conflict(kind,dedupe_key) do nothing returning id,kind`,
    [now, dailyEnabled, applyEnabled],
  );
  // Matching and digest preparation are deliberately sequenced. A digest is
  // created only after that local day's match item completed, so queue timing
  // cannot produce an empty or previous-day snapshot.
  const digestRows = dailyEnabled ? await q<ScheduledRow>(
    `with due as (
       select c.id,c.user_id,(($1 at time zone c.timezone)::date)::text local_date
       from job_campaigns c join users u on u.id=c.user_id and u.deleting_at is null
       join feature_access_grants g on g.user_id=c.user_id and g.feature_key='daily_matches'
         and g.state='approved' and (g.expires_at is null or g.expires_at>now())
       where c.status='active' and c.mode='daily_matches'
         and (($1 at time zone c.timezone)::time >= c.daily_time)
     )
     insert into job_work_items(user_id,kind,aggregate_id,dedupe_key,available_at)
       select d.user_id,'jobs_digest',d.id,d.id::text||':'||d.local_date||':digest',$1
       from due d where exists (
         select 1 from job_work_items w where w.kind='jobs_match'
           and w.dedupe_key=d.id::text||':'||d.local_date||':match' and w.status='completed'
       )
     on conflict(kind,dedupe_key) do nothing returning id,kind`, [now],
  ) : [];
  const pending = await q<ScheduledRow>(
    `select id,kind from job_work_items
     where status in ('pending','retryable') and available_at<=now()
     order by available_at,created_at limit 500`,
  );
  await Promise.all(pending.map((row) => enqueueWorkflow(queueFor(row.kind), {
    workItemId: row.id, version: 1,
  })));
  const mailboxAttempts = applyEnabled ? await q<{ id: string; next_ordinal: number }>(
    `select a.id,
       case when a.status='queued' then 1 else a.current_invocation_ordinal+1 end next_ordinal
     from application_mail_attempts a
     join users u on u.id=a.user_id and u.deleting_at is null
     join email_connections e on e.id=a.connection_id and e.user_id=a.user_id
     join feature_access_grants g on g.user_id=a.user_id
       and g.feature_key=case when e.provider='google' then 'role_apply_gmail' else 'role_apply_microsoft' end
       and g.state='approved' and (g.expires_at is null or g.expires_at>now())
     where (a.status='queued' and a.current_invocation_ordinal=0)
       or (a.status='retryable' and a.retry_not_before<=now()
         and a.current_invocation_ordinal between 1 and 2)
     order by case when a.status='queued' then a.created_at else a.retry_not_before end,a.id
     limit 500`,
  ) : [];
  await Promise.all(mailboxAttempts.map((attempt) => enqueueMailbox(
    { attemptId: attempt.id, version: 1 }, Number(attempt.next_ordinal),
  )));
  const notificationRows = dailyEnabled ? await q<{ id: string }>(
    `select o.id from notification_outbox o
     join users u on u.id=o.user_id and u.deleting_at is null
     where o.status='pending'
       or (o.status='claimed' and o.lease_expires_at<=now())
     order by o.created_at,o.id limit 500`,
  ) : [];
  await Promise.all(notificationRows.map((outbox) => enqueueNotification({
    outboxId: outbox.id, version: 1,
  })));
  return rows.length + digestRows.length + mailboxAttempts.length + notificationRows.length + blogRows.length;
}
