import { q, withTransaction } from "../db";

export const WORK_ITEM_KINDS = ["jobs_match", "jobs_digest", "application_package"] as const;
export type WorkItemKind = (typeof WORK_ITEM_KINDS)[number];

export type ClaimedWorkItem = {
  id: string;
  userId: string;
  kind: WorkItemKind;
  aggregateId: string;
  payloadVersion: number;
  attemptCount: number;
  leaseExpiresAt: string;
};

type WorkItemRow = {
  id: string;
  user_id: string;
  kind: WorkItemKind;
  aggregate_id: string;
  payload_version: number;
  attempt_count: number;
  lease_expires_at: string;
};

function mapRow(row: WorkItemRow): ClaimedWorkItem {
  return {
    id: row.id, userId: row.user_id, kind: row.kind, aggregateId: row.aggregate_id,
    payloadVersion: row.payload_version, attemptCount: row.attempt_count,
    leaseExpiresAt: row.lease_expires_at,
  };
}

export async function claimDueWorkItems(input: {
  kinds: readonly WorkItemKind[];
  owner: string;
  limit?: number;
  leaseSeconds?: number;
}): Promise<ClaimedWorkItem[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));
  const leaseSeconds = Math.max(15, Math.min(input.leaseSeconds ?? 60, 300));
  if (!input.owner || input.owner.length > 120) throw new Error("invalid_lease_owner");
  if (!input.kinds.length || input.kinds.some((kind) => !WORK_ITEM_KINDS.includes(kind))) {
    throw new Error("invalid_work_item_kind");
  }
  return withTransaction(async (query) => {
    await query(
      `update job_work_items set status='terminal_failed',failure_category='lease_retry_ceiling',
         lease_owner=null,lease_expires_at=null,terminal_at=now(),updated_at=now()
       where kind=any($1::text[]) and status='claimed' and lease_expires_at<=now()
         and attempt_count>=max_attempts`, [input.kinds],
    );
    const rows = await query<WorkItemRow>(
      `with candidates as (
         select w.id from job_work_items w
         join users u on u.id=w.user_id and u.deleting_at is null
         join feature_access_grants g on g.user_id=w.user_id
           and g.feature_key=case
             when w.kind in ('jobs_digest') then 'daily_matches'
             when w.kind='application_package' then 'role_apply_prepare'
             else coalesce((select case when c.mode='daily_matches' then 'daily_matches' else 'role_apply_prepare' end
               from job_campaigns c where c.id=w.aggregate_id), 'daily_matches')
           end
           and g.state='approved' and (g.expires_at is null or g.expires_at>now())
         where w.kind=any($1::text[]) and w.available_at<=now()
           and (w.status in ('pending','retryable')
             or (w.status='claimed' and w.lease_expires_at<=now()))
           and w.attempt_count<w.max_attempts
         order by w.available_at,w.created_at,w.id
         for update of w skip locked limit $2
       )
       update job_work_items w set status='claimed',lease_owner=$3,
         lease_expires_at=now()+make_interval(secs=>$4),heartbeat_at=now(),
         attempt_count=w.attempt_count+1,updated_at=now()
       from candidates c where w.id=c.id
       returning w.id,w.user_id,w.kind,w.aggregate_id,w.payload_version,
         w.attempt_count,w.lease_expires_at`,
      [input.kinds, limit, input.owner, leaseSeconds],
    );
    return rows.map(mapRow);
  });
}

export async function claimWorkItemById(input: {
  id: string;
  expectedKind: WorkItemKind;
  expectedVersion: number;
  owner: string;
  leaseSeconds?: number;
}): Promise<ClaimedWorkItem | null> {
  const leaseSeconds = Math.max(15, Math.min(input.leaseSeconds ?? 60, 300));
  return withTransaction(async (query) => {
    await query(
      `update job_work_items set status='terminal_failed',failure_category='lease_retry_ceiling',
         lease_owner=null,lease_expires_at=null,terminal_at=now(),updated_at=now()
       where id=$1 and kind=$2 and payload_version=$3 and status='claimed'
         and lease_expires_at<=now() and attempt_count>=max_attempts`,
      [input.id, input.expectedKind, input.expectedVersion],
    );
    const rows = await query<WorkItemRow>(
      `update job_work_items w set status='claimed',lease_owner=$4,
         lease_expires_at=now()+make_interval(secs=>$5),heartbeat_at=now(),
         attempt_count=w.attempt_count+1,updated_at=now()
       from users u
       where w.id=$1 and w.kind=$2 and w.payload_version=$3
         and u.id=w.user_id and u.deleting_at is null and w.available_at<=now()
         and exists (
           select 1 from feature_access_grants g
           where g.user_id=w.user_id and g.state='approved'
             and (g.expires_at is null or g.expires_at>now())
             and g.feature_key=case
               when w.kind='jobs_digest' then 'daily_matches'
               when w.kind='application_package' then 'role_apply_prepare'
               else coalesce((select case when c.mode='daily_matches' then 'daily_matches' else 'role_apply_prepare' end
                 from job_campaigns c where c.id=w.aggregate_id), 'daily_matches')
             end
         )
         and (w.status in ('pending','retryable')
           or (w.status='claimed' and w.lease_expires_at<=now()))
         and w.attempt_count<w.max_attempts
       returning w.id,w.user_id,w.kind,w.aggregate_id,w.payload_version,
         w.attempt_count,w.lease_expires_at`,
      [input.id, input.expectedKind, input.expectedVersion, input.owner, leaseSeconds],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  });
}

export async function heartbeatWorkItem(id: string, owner: string, leaseSeconds = 60): Promise<boolean> {
  const rows = await q<{ id: string }>(
    `update job_work_items set heartbeat_at=now(),lease_expires_at=now()+make_interval(secs=>$3),updated_at=now()
     where id=$1 and status='claimed' and lease_owner=$2 and lease_expires_at>now() returning id`,
    [id, owner, Math.max(15, Math.min(leaseSeconds, 300))],
  );
  return Boolean(rows[0]);
}

export async function completeWorkItem(input: {
  id: string;
  owner: string;
  resultReferenceId?: string;
}): Promise<boolean> {
  const rows = await q<{ id: string }>(
    `update job_work_items set status='completed',result_reference_id=$3,
       lease_owner=null,lease_expires_at=null,terminal_at=now(),updated_at=now()
     where id=$1 and status='claimed' and lease_owner=$2 and lease_expires_at>now() returning id`,
    [input.id, input.owner, input.resultReferenceId ?? null],
  );
  return Boolean(rows[0]);
}

export async function failWorkItem(input: {
  id: string;
  owner: string;
  category: string;
  outcome: "retryable" | "unknown" | "terminal_failed";
  retryDelaySeconds?: number;
}): Promise<boolean> {
  if (!/^[a-z0-9_.-]{1,80}$/u.test(input.category)) throw new Error("invalid_failure_category");
  return withTransaction(async (query) => {
    const row = (await query<{ attempt_count: number; max_attempts: number }>(
      "select attempt_count,max_attempts from job_work_items where id=$1 and status='claimed' and lease_owner=$2 and lease_expires_at>now() for update",
      [input.id, input.owner],
    ))[0];
    if (!row) return false;
    const outcome = input.outcome === "retryable" && row.attempt_count >= row.max_attempts
      ? "terminal_failed" : input.outcome;
    const terminal = outcome === "retryable" ? null : new Date();
    const rows = await query<{ id: string }>(
      `update job_work_items set status=$3,failure_category=$4,
         available_at=case when $3='retryable' then now()+make_interval(secs=>$5) else available_at end,
         lease_owner=null,lease_expires_at=null,terminal_at=$6,updated_at=now()
       where id=$1 and status='claimed' and lease_owner=$2 returning id`,
      [input.id, input.owner, outcome, input.category,
        Math.max(1, Math.min(input.retryDelaySeconds ?? 30, 3600)), terminal],
    );
    return Boolean(rows[0]);
  });
}
