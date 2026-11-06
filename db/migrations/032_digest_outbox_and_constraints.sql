-- Digest/outbox point-of-no-return boundaries and database state guards.
-- SIZE_OK: declarative constraints/triggers and their transaction helpers form
-- one atomic migration boundary; no application module imports this SQL.

create table if not exists digest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  campaign_id uuid not null,
  local_date date not null,
  account_email_version_id uuid not null,
  account_email_version integer not null,
  ordered_snapshot jsonb not null,
  status text not null default 'prepared' check (
    status in ('prepared', 'queued', 'provider_accepted', 'failed', 'unknown', 'needs_user')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, user_id) references job_campaigns(id, user_id),
  foreign key (account_email_version_id, user_id, account_email_version)
    references account_email_versions(id, user_id, version),
  unique (user_id, local_date),
  unique (id, user_id),
  unique (id, user_id, account_email_version_id)
);

create table if not exists digest_inclusions (
  digest_run_id uuid not null,
  user_id uuid not null,
  canonical_job_key text not null,
  ordinal integer not null check (ordinal between 1 and 10),
  job_snapshot_id uuid not null,
  included_at timestamptz not null default now(),
  primary key (digest_run_id, canonical_job_key),
  foreign key (digest_run_id, user_id) references digest_runs(id, user_id) on delete cascade,
  foreign key (job_snapshot_id, canonical_job_key)
    references job_snapshots(id, canonical_job_key),
  unique (user_id, canonical_job_key),
  unique (digest_run_id, ordinal)
);

create table if not exists notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  aggregate_type text not null check (aggregate_type in ('digest_run', 'account_notice')),
  aggregate_id uuid not null,
  account_email_version_id uuid not null,
  payload_reference_ids uuid[] not null,
  status text not null default 'pending' check (
    status in (
      'pending', 'claimed', 'sending', 'provider_accepted',
      'failed', 'unknown', 'needs_user', 'canceled'
    )
  ),
  invocation_ordinal integer not null default 0 check (invocation_ordinal in (0, 1)),
  provider_call_started_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  classification text,
  receipt_hash text check (receipt_hash is null or receipt_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  terminal_at timestamptz,
  purge_after timestamptz,
  foreign key (account_email_version_id, user_id)
    references account_email_versions(id, user_id),
  check (cardinality(payload_reference_ids) > 0),
  check (
    (status in ('provider_accepted', 'failed', 'unknown', 'needs_user')
      and classification = status)
    or (status not in ('provider_accepted', 'failed', 'unknown', 'needs_user')
      and classification is null)
  ),
  check (status <> 'provider_accepted' or receipt_hash is not null),
  check (
    (status = 'claimed' and lease_owner is not null
      and lease_expires_at is not null and lease_expires_at > updated_at)
    or (status <> 'claimed' and lease_owner is null and lease_expires_at is null)
  ),
  check (
    (status = 'sending' and invocation_ordinal = 1
      and provider_call_started_at is not null and terminal_at is null)
    or
    (status in ('provider_accepted', 'failed', 'unknown', 'needs_user', 'canceled')
      and terminal_at is not null and purge_after = terminal_at + interval '30 days')
    or
    (status in ('pending', 'claimed') and invocation_ordinal = 0
      and provider_call_started_at is null and terminal_at is null and purge_after is null)
  ),
  unique (aggregate_type, aggregate_id),
  unique (id, user_id)
);

create table if not exists notification_outbox_invocations (
  outbox_id uuid primary key,
  user_id uuid not null,
  ordinal integer not null check (ordinal = 1),
  started_at timestamptz not null,
  finished_at timestamptz,
  classification text,
  receipt_hash text check (receipt_hash is null or receipt_hash ~ '^[0-9a-f]{64}$'),
  foreign key (outbox_id, user_id) references notification_outbox(id, user_id) on delete cascade,
  check (
    classification is null or classification in (
      'provider_accepted', 'failed', 'unknown', 'needs_user'
    )
  ),
  check (classification <> 'provider_accepted' or receipt_hash is not null),
  check ((finished_at is null) = (classification is null))
);

create or replace function reject_immutable_workflow_row()
returns trigger language plpgsql as $$
begin
  raise exception '% is immutable', tg_table_name using errcode = '55000';
end;
$$;

create or replace function enforce_monotonic_user_version()
returns trigger language plpgsql as $$
declare
  latest_version integer;
begin
  perform 1 from users where id = new.user_id for update;
  select max(version) into latest_version
    from career_profile_versions where user_id = new.user_id;
  if tg_table_name = 'account_email_versions' then
    select max(version) into latest_version
      from account_email_versions where user_id = new.user_id;
  end if;
  if new.version <> coalesce(latest_version, 0) + 1 then
    raise exception '% version must be the next monotonic value', tg_table_name
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists career_profile_versions_monotonic on career_profile_versions;
create trigger career_profile_versions_monotonic
before insert on career_profile_versions
for each row execute function enforce_monotonic_user_version();

drop trigger if exists account_email_versions_monotonic on account_email_versions;
create trigger account_email_versions_monotonic
before insert on account_email_versions
for each row execute function enforce_monotonic_user_version();

create or replace function enforce_iana_timezone()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.quota_timezone) then
    raise exception 'invalid IANA quota timezone' using errcode = '23514';
  end if;
  if new.pending_quota_timezone is not null
    and not exists (
      select 1 from pg_timezone_names where name = new.pending_quota_timezone
    ) then
    raise exception 'invalid pending IANA quota timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists application_send_policies_timezone on application_send_policies;
create trigger application_send_policies_timezone
before insert or update of quota_timezone, pending_quota_timezone
on application_send_policies
for each row execute function enforce_iana_timezone();

create or replace function enforce_campaign_timezone()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid IANA campaign timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists job_campaigns_timezone on job_campaigns;
create trigger job_campaigns_timezone
before insert or update of timezone on job_campaigns
for each row execute function enforce_campaign_timezone();

create or replace function enforce_campaign_activation()
returns trigger language plpgsql as $$
begin
  if new.mode = 'daily_matches' and new.pinned_connection_id is not null then
    raise exception 'daily-matches campaign cannot pin a mailbox'
      using errcode = '23514';
  end if;
  if new.mode = 'role_apply' and new.status = 'active' then
    if new.pinned_connection_id is null
      or not exists (
        select 1 from email_connections
          where id = new.pinned_connection_id
            and user_id = new.user_id
            and status = 'active'
      )
      or not exists (
        select 1 from application_send_policies where user_id = new.user_id
      ) then
      raise exception 'active Apply campaign requires owner mailbox and global policy'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_campaigns_activation on job_campaigns;
create trigger job_campaigns_activation
before insert or update of status, pinned_connection_id on job_campaigns
for each row execute function enforce_campaign_activation();

drop trigger if exists career_profile_versions_immutable on career_profile_versions;
create trigger career_profile_versions_immutable before update on career_profile_versions
for each row execute function reject_immutable_workflow_row();

drop trigger if exists account_email_versions_immutable on account_email_versions;
create trigger account_email_versions_immutable before update on account_email_versions
for each row execute function reject_immutable_workflow_row();

drop trigger if exists job_snapshots_immutable on job_snapshots;
create trigger job_snapshots_immutable before update on job_snapshots
for each row execute function reject_immutable_workflow_row();

drop trigger if exists email_connections_identity_immutable on email_connections;
create trigger email_connections_identity_immutable
before update of user_id, provider, provider_tenant, provider_subject,
  verified_sender, granted_scopes, connection_generation, created_at
on email_connections
for each row execute function reject_immutable_workflow_row();

drop trigger if exists application_packages_immutable on application_packages;
create trigger application_packages_immutable
before update of user_id, canonical_job_key, canonical_company_key, job_snapshot_id,
  profile_version_id, resume_id, template_version, policy_version, score_version,
  extraction_version, connection_id, connection_generation, recipient_record,
  subject, body, attachment_hash, attachment_bytes_hash, package_hash, created_at
on application_packages
for each row execute function reject_immutable_workflow_row();

drop trigger if exists package_approvals_receipt_immutable on package_approvals;
create trigger package_approvals_receipt_immutable
before update of user_id, package_id, package_hash, authorization_mode, actor,
  campaign_id, campaign_consent_version, selected_recipient, expires_at, approved_at
on package_approvals
for each row execute function reject_immutable_workflow_row();

drop trigger if exists digest_runs_snapshot_immutable on digest_runs;
create trigger digest_runs_snapshot_immutable
before update of user_id, campaign_id, local_date, account_email_version_id,
  account_email_version, ordered_snapshot, created_at
on digest_runs
for each row execute function reject_immutable_workflow_row();

drop trigger if exists digest_inclusions_immutable on digest_inclusions;
create trigger digest_inclusions_immutable before update on digest_inclusions
for each row execute function reject_immutable_workflow_row();

create or replace function enforce_package_approval_contract()
returns trigger language plpgsql as $$
declare
  package_row application_packages%rowtype;
  campaign_row job_campaigns%rowtype;
begin
  select * into package_row from application_packages
    where id = new.package_id and user_id = new.user_id
      and package_hash = new.package_hash;
  if not found or package_row.status <> 'ready' then
    raise exception 'approval requires the owner immutable ready package'
      using errcode = '23514';
  end if;
  select * into campaign_row from job_campaigns
    where id = new.campaign_id and user_id = new.user_id;
  if not found or campaign_row.mode <> 'role_apply'
    or campaign_row.pinned_connection_id is distinct from package_row.connection_id then
    raise exception 'approval campaign or pinned connection mismatch'
      using errcode = '23514';
  end if;
  if new.authorization_mode = 'campaign_policy'
    and (
      campaign_row.authorization_mode <> 'campaign_policy'
      or campaign_row.consent_version is distinct from new.campaign_consent_version
      or campaign_row.consent_expires_at is null
      or campaign_row.consent_expires_at <= new.approved_at
    ) then
    raise exception 'campaign approval requires current explicit consent'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists package_approvals_contract on package_approvals;
create trigger package_approvals_contract
before insert on package_approvals
for each row execute function enforce_package_approval_contract();

create or replace function enforce_attempt_contract()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.canonical_job_key is distinct from old.canonical_job_key
      or new.canonical_company_key is distinct from old.canonical_company_key then
      raise exception 'attempt identity is immutable' using errcode = '55000';
    end if;
    if (
      new.package_id is distinct from old.package_id
      or new.approval_id is distinct from old.approval_id
      or new.campaign_id is distinct from old.campaign_id
      or new.connection_id is distinct from old.connection_id
    ) and not (
      (old.status = 'needs_user' and new.status in ('needs_user', 'queued'))
      or (old.status = 'retryable' and new.status in ('retryable', 'reserved'))
    ) then
      raise exception 'attempt authorization can change only during revalidation'
        using errcode = '55000';
    end if;
  end if;
  perform 1
  from application_packages p
  join package_approvals a
    on a.id = new.approval_id
    and a.user_id = p.user_id
    and a.package_id = p.id
    and a.package_hash = p.package_hash
  join job_campaigns c
    on c.id = new.campaign_id and c.user_id = p.user_id
  where p.id = new.package_id
    and p.user_id = new.user_id
    and p.canonical_job_key = new.canonical_job_key
    and p.canonical_company_key = new.canonical_company_key
    and p.connection_id = new.connection_id
    and c.mode = 'role_apply'
    and c.pinned_connection_id = new.connection_id;
  if not found then
    raise exception 'attempt ownership or immutable authorization mismatch'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists application_mail_attempts_contract on application_mail_attempts;
create trigger application_mail_attempts_contract
before insert or update of user_id, canonical_job_key, canonical_company_key,
  package_id, approval_id, campaign_id, connection_id
on application_mail_attempts
for each row execute function enforce_attempt_contract();

create or replace function enforce_application_invocation_boundary()
returns trigger language plpgsql as $$
begin
  if old.status = 'reserved' and new.status = 'sending' then
    if new.current_invocation_ordinal <> old.current_invocation_ordinal + 1
      or not exists (
        select 1 from application_mail_invocations
          where attempt_id = new.id and user_id = new.user_id
            and ordinal = new.current_invocation_ordinal
      )
      or not exists (
        select 1 from application_quota_reservations
          where attempt_id = new.id and user_id = new.user_id
            and ordinal = new.current_invocation_ordinal
      )
      or not exists (
        select 1 from application_daily_counters
          where user_id = new.user_id
            and policy_generation = new.reservation_generation
            and local_date = new.reservation_local_date
            and count > 0
      )
      or not exists (
        select 1 from application_company_cooldown_heads
          where user_id = new.user_id
            and canonical_company_key = new.canonical_company_key
            and owner_attempt_id = new.id
      ) then
      raise exception 'application invocation boundary must be atomic'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists application_mail_attempts_boundary on application_mail_attempts;
create trigger application_mail_attempts_boundary
before update of status on application_mail_attempts
for each row execute function enforce_application_invocation_boundary();

create or replace function reject_attempt_ledger_rewrite()
returns trigger language plpgsql as $$
begin
  if old.status = new.status then
    raise exception 'attempt ledger fields change only with a legal transition'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists application_mail_attempts_ledger_immutable
on application_mail_attempts;
create trigger application_mail_attempts_ledger_immutable
before update of reservation_generation, reservation_local_date,
  current_invocation_ordinal, provider_call_started_at,
  provider_acceptance_hash, terminal_at
on application_mail_attempts
for each row execute function reject_attempt_ledger_rewrite();

create or replace function enforce_invocation_completion_once()
returns trigger language plpgsql as $$
begin
  if old.finished_at is not null
    or new.finished_at is null
    or new.classification is null then
    raise exception 'invocation receipt can be completed exactly once'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists application_mail_invocations_complete_once
on application_mail_invocations;
create trigger application_mail_invocations_complete_once
before update on application_mail_invocations
for each row execute function enforce_invocation_completion_once();

drop trigger if exists application_mail_invocations_identity_immutable
on application_mail_invocations;
create trigger application_mail_invocations_identity_immutable
before update of attempt_id, user_id, ordinal, policy_generation,
  local_date, not_before, started_at
on application_mail_invocations
for each row execute function reject_immutable_workflow_row();

drop trigger if exists notification_outbox_invocations_complete_once
on notification_outbox_invocations;
create trigger notification_outbox_invocations_complete_once
before update on notification_outbox_invocations
for each row execute function enforce_invocation_completion_once();

drop trigger if exists notification_outbox_invocations_identity_immutable
on notification_outbox_invocations;
create trigger notification_outbox_invocations_identity_immutable
before update of outbox_id, user_id, ordinal, started_at
on notification_outbox_invocations
for each row execute function reject_immutable_workflow_row();

drop trigger if exists application_quota_reservations_immutable
on application_quota_reservations;
create trigger application_quota_reservations_immutable
before update on application_quota_reservations
for each row execute function reject_immutable_workflow_row();

create or replace function enforce_digest_contract()
returns trigger language plpgsql as $$
begin
  perform 1 from job_campaigns
    where id = new.campaign_id and user_id = new.user_id
      and mode = 'daily_matches';
  if not found then
    raise exception 'digest requires the owner daily-matches campaign'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists digest_runs_contract on digest_runs;
create trigger digest_runs_contract
before insert on digest_runs
for each row execute function enforce_digest_contract();

create or replace function enforce_notification_outbox_contract()
returns trigger language plpgsql as $$
begin
  if new.aggregate_type = 'digest_run' then
    perform 1 from digest_runs
      where id = new.aggregate_id and user_id = new.user_id
        and account_email_version_id = new.account_email_version_id;
    if not found then
      raise exception 'digest outbox aggregate ownership mismatch'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notification_outbox_contract on notification_outbox;
create trigger notification_outbox_contract
before insert on notification_outbox
for each row execute function enforce_notification_outbox_contract();

create or replace function enforce_notification_invocation_boundary()
returns trigger language plpgsql as $$
begin
  if old.status = 'claimed' and new.status = 'sending'
    and (
      new.invocation_ordinal <> 1
      or not exists (
        select 1 from notification_outbox_invocations
          where outbox_id = new.id and user_id = new.user_id and ordinal = 1
      )
    ) then
    raise exception 'notification invocation boundary must be atomic'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists notification_outbox_boundary on notification_outbox;
create trigger notification_outbox_boundary
before update of status on notification_outbox
for each row execute function enforce_notification_invocation_boundary();

create or replace function enforce_canonical_job_conflict()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from canonical_job_aliases
        where canonical_job_key = new.left_canonical_job_key
          and verified_official_url_hash = new.official_url_hash
    ) or not exists (
      select 1 from canonical_job_aliases
        where canonical_job_key = new.right_canonical_job_key
          and verified_official_url_hash = new.official_url_hash
    ) then
      raise exception 'conflict requires URL-backed aliases on both canonical jobs'
        using errcode = '23514';
    end if;
    update canonical_jobs set
      merge_state = 'conflicted',
      automation_blocked = true,
      updated_at = now()
      where canonical_job_key in (
        new.left_canonical_job_key, new.right_canonical_job_key
      );
  elsif old.state = 'open' and new.state = 'reconciled' then
    update canonical_jobs set
      merge_state = case
        when canonical_job_key = new.survivor_canonical_job_key
          then 'canonical' else 'merged'
      end,
      merged_into_key = case
        when canonical_job_key = new.survivor_canonical_job_key
          then null else new.survivor_canonical_job_key
      end,
      automation_blocked = canonical_job_key <> new.survivor_canonical_job_key,
      updated_at = now()
      where canonical_job_key in (
        new.left_canonical_job_key, new.right_canonical_job_key
      );
  else
    raise exception 'canonical job conflict receipt is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists canonical_job_conflicts_guard on canonical_job_conflicts;
create trigger canonical_job_conflicts_guard
before insert or update of state, survivor_canonical_job_key, reconciled_at
on canonical_job_conflicts
for each row execute function enforce_canonical_job_conflict();

drop trigger if exists canonical_job_conflicts_identity_immutable on canonical_job_conflicts;
create trigger canonical_job_conflicts_identity_immutable
before update of official_url_hash, left_canonical_job_key,
  right_canonical_job_key, reason, created_at
on canonical_job_conflicts
for each row execute function reject_immutable_workflow_row();

create or replace function reject_oauth_state_replay()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from oauth_state_tombstones
      where state_hash = new.state_hash and retain_until > now()
  ) then
    raise exception 'OAuth state replay tombstone exists' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists oauth_transactions_replay on oauth_transactions;
create trigger oauth_transactions_replay
before insert on oauth_transactions
for each row execute function reject_oauth_state_replay();

create or replace function retire_oauth_transaction(
  requested_transaction_id uuid,
  requested_terminal_status text
) returns integer language plpgsql as $$
declare
  transaction_row oauth_transactions%rowtype;
  terminal_at timestamptz := now();
begin
  if requested_terminal_status not in ('consumed', 'expired') then
    raise exception 'invalid OAuth terminal status' using errcode = '23514';
  end if;
  select * into transaction_row from oauth_transactions
    where id = requested_transaction_id for update;
  if not found or transaction_row.status <> 'pending' then
    return 0;
  end if;
  if requested_terminal_status = 'consumed'
    and terminal_at > transaction_row.expires_at then
    raise exception 'expired OAuth transaction cannot be consumed'
      using errcode = '23514';
  end if;
  update oauth_transactions set
    status = requested_terminal_status,
    consumed_at = case
      when requested_terminal_status = 'consumed' then terminal_at else null
    end
    where id = requested_transaction_id and status = 'pending';
  insert into oauth_state_tombstones(
    state_hash, terminal_status, retain_until, created_at
  ) values (
    transaction_row.state_hash, requested_terminal_status,
    terminal_at + interval '24 hours', terminal_at
  );
  delete from oauth_transactions where id = requested_transaction_id;
  return 1;
end;
$$;

create or replace function purge_oauth_state_tombstones(
  cleanup_at timestamptz default now()
) returns integer language plpgsql as $$
declare
  removed integer;
begin
  delete from oauth_state_tombstones where retain_until <= cleanup_at;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function enforce_workflow_transition()
returns trigger language plpgsql as $$
declare
  legal boolean := false;
begin
  if old.status = new.status then
    return new;
  end if;

  if tg_table_name = 'job_campaigns' then
    legal := (old.status = 'draft' and new.status in ('active', 'canceled'))
      or (old.status = 'active' and new.status in ('paused', 'needs_user', 'expired', 'canceled'))
      or (old.status = 'paused' and new.status in ('active', 'needs_user', 'expired', 'canceled'))
      or (old.status = 'needs_user' and new.status in ('active', 'paused', 'expired', 'canceled'));
  elsif tg_table_name = 'oauth_transactions' then
    legal := old.status = 'pending' and new.status in ('consumed', 'expired');
  elsif tg_table_name = 'email_connections' then
    legal := (old.status = 'active' and new.status in ('needs_user', 'disabled'))
      or (old.status = 'needs_user' and new.status in ('active', 'disabled'));
  elsif tg_table_name = 'application_packages' then
    legal := (old.status = 'preparing'
        and new.status in ('review_required', 'ready', 'blocked', 'stale'))
      or (old.status = 'review_required' and new.status in ('ready', 'blocked', 'stale'))
      or (old.status = 'ready' and new.status in ('blocked', 'stale'));
  elsif tg_table_name = 'package_approvals' then
    legal := old.status = 'active' and new.status in ('invalidated', 'expired', 'consumed');
  elsif tg_table_name = 'application_mail_attempts' then
    legal := (old.status = 'queued' and new.status in ('blocked', 'canceled', 'reserved'))
      or (old.status = 'reserved' and new.status in ('blocked', 'canceled', 'sending'))
      or (old.status = 'sending' and new.status in (
        'provider_accepted', 'unknown', 'needs_user', 'retryable', 'terminal_failed'
      ))
      or (old.status = 'retryable' and new.status in (
        'reserved', 'terminal_failed', 'blocked', 'canceled'
      ))
      or (old.status = 'needs_user' and new.status in ('queued', 'canceled'));
  elsif tg_table_name = 'digest_runs' then
    legal := (old.status = 'prepared' and new.status = 'queued')
      or (old.status = 'queued' and new.status in (
        'provider_accepted', 'failed', 'unknown', 'needs_user'
      ));
  elsif tg_table_name = 'notification_outbox' then
    legal := (old.status = 'pending' and new.status in ('claimed', 'canceled'))
      or (old.status = 'claimed' and new.status in ('sending', 'canceled'))
      or (old.status = 'sending' and new.status in (
        'provider_accepted', 'failed', 'unknown', 'needs_user'
      ));
  end if;

  if not legal then
    raise exception 'illegal % transition: % -> %', tg_table_name, old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'job_campaigns', 'oauth_transactions', 'email_connections', 'application_packages',
    'package_approvals', 'application_mail_attempts', 'digest_runs',
    'notification_outbox'
  ]
  loop
    execute format('drop trigger if exists %I on %I', table_name || '_transition', table_name);
    execute format(
      'create trigger %I before update of status on %I for each row execute function enforce_workflow_transition()',
      table_name || '_transition', table_name
    );
  end loop;
end;
$$;

create or replace function start_application_mail_invocation(
  requested_attempt_id uuid,
  requested_not_before timestamptz default now()
) returns integer language plpgsql as $$
declare
  attempt_row application_mail_attempts%rowtype;
  policy_row application_send_policies%rowtype;
  package_row application_packages%rowtype;
  active_generation integer;
  active_timezone text;
  quota_date date;
  next_ordinal integer;
  current_count integer;
  counter_cap integer;
  cooldown_owner uuid;
  boundary_at timestamptz := now();
begin
  if requested_not_before > boundary_at then
    raise exception 'application invocation is before not_before'
      using errcode = '23514';
  end if;
  select * into attempt_row from application_mail_attempts where id = requested_attempt_id;
  if not found then
    return 0;
  end if;

  perform 1 from users
    where id = attempt_row.user_id and deleting_at is null
    for update;
  if not found then
    return 0;
  end if;

  select * into policy_row from application_send_policies
    where user_id = attempt_row.user_id for update;
  if not found then
    raise exception 'missing application send policy' using errcode = '23514';
  end if;

  active_generation := policy_row.timezone_generation;
  active_timezone := policy_row.quota_timezone;
  quota_date := (boundary_at at time zone active_timezone)::date;
  if policy_row.next_generation_activation_date is not null
    and quota_date >= policy_row.next_generation_activation_date then
    active_generation := policy_row.pending_timezone_generation;
    active_timezone := policy_row.pending_quota_timezone;
    quota_date := (boundary_at at time zone active_timezone)::date;
    update application_send_policies set
      quota_timezone = pending_quota_timezone,
      timezone_generation = pending_timezone_generation,
      pending_quota_timezone = null,
      pending_timezone_generation = null,
      next_generation_activation_date = null,
      updated_at = now()
      where user_id = attempt_row.user_id;
  end if;

  insert into application_daily_counters (
    user_id, policy_generation, local_date, count, effective_cap_snapshot
  ) values (
    attempt_row.user_id, active_generation, quota_date, 0, policy_row.effective_cap
  ) on conflict (user_id, policy_generation, local_date) do nothing;

  select count, effective_cap_snapshot into current_count, counter_cap
    from application_daily_counters
    where user_id = attempt_row.user_id
      and policy_generation = active_generation and local_date = quota_date
    for update;
  if current_count >= counter_cap then
    raise exception 'application daily cap reached' using errcode = '23514';
  end if;

  insert into application_company_cooldown_heads (
    user_id, canonical_company_key, owner_attempt_id, last_consuming_at
  ) values (
    attempt_row.user_id, attempt_row.canonical_company_key,
    requested_attempt_id, boundary_at
  ) on conflict (user_id, canonical_company_key) do update
    set owner_attempt_id = excluded.owner_attempt_id,
        last_consuming_at = excluded.last_consuming_at
    where application_company_cooldown_heads.owner_attempt_id = excluded.owner_attempt_id
      or excluded.last_consuming_at >=
        application_company_cooldown_heads.last_consuming_at + interval '14 days'
  returning owner_attempt_id into cooldown_owner;
  if not found then
    raise exception 'application company cooldown active' using errcode = '23514';
  end if;

  perform 1 from job_campaigns
    where id = attempt_row.campaign_id and user_id = attempt_row.user_id
      and status = 'active'
      and mode = 'role_apply'
      and pinned_connection_id = attempt_row.connection_id
      and (authorization_mode <> 'campaign_policy' or consent_expires_at > now())
    for update;
  if not found then
    raise exception 'campaign is not active' using errcode = '23514';
  end if;

  select * into package_row from application_packages
    where id = attempt_row.package_id;
  if not found then
    raise exception 'package is missing' using errcode = '23514';
  end if;

  perform 1 from email_connections c
    where c.id = attempt_row.connection_id and c.user_id = attempt_row.user_id
      and c.status = 'active'
      and c.id = package_row.connection_id
      and c.connection_generation = package_row.connection_generation
    for update;
  if not found then
    raise exception 'mail connection is not active' using errcode = '23514';
  end if;

  select * into attempt_row from application_mail_attempts
    where id = requested_attempt_id for update;
  if attempt_row.status <> 'reserved' then
    raise exception 'attempt is not reserved' using errcode = '23514';
  end if;

  select * into package_row from application_packages
    where id = attempt_row.package_id for update;
  if package_row.status <> 'ready' then
    raise exception 'package is not ready' using errcode = '23514';
  end if;

  perform 1 from package_approvals
    where id = attempt_row.approval_id
      and user_id = attempt_row.user_id
      and package_id = attempt_row.package_id
      and package_hash = package_row.package_hash
      and (
        (attempt_row.current_invocation_ordinal = 0 and status = 'active')
        or (attempt_row.current_invocation_ordinal > 0 and status = 'consumed')
      )
      and expires_at > now()
    for update;
  if not found then
    raise exception 'approval is not active' using errcode = '23514';
  end if;

  perform 1 from canonical_companies
    where canonical_company_key = attempt_row.canonical_company_key
      and identity_state = 'verified' and not automation_blocked;
  if not found then
    raise exception 'company identity blocks automation' using errcode = '23514';
  end if;

  perform 1 from canonical_jobs
    where canonical_job_key = attempt_row.canonical_job_key
      and merge_state = 'canonical' and not automation_blocked;
  if not found then
    raise exception 'canonical job blocks automation' using errcode = '23514';
  end if;

  next_ordinal := attempt_row.current_invocation_ordinal + 1;
  insert into application_mail_invocations (
    attempt_id, user_id, ordinal, policy_generation, local_date, not_before, started_at
  ) values (
    requested_attempt_id, attempt_row.user_id, next_ordinal,
    active_generation, quota_date, requested_not_before, now()
  );
  insert into application_quota_reservations (
    attempt_id, user_id, ordinal, policy_generation, local_date, effective_cap_snapshot
  ) values (
    requested_attempt_id, attempt_row.user_id, next_ordinal,
    active_generation, quota_date, counter_cap
  );
  update application_daily_counters set count = count + 1, updated_at = now()
    where user_id = attempt_row.user_id
      and policy_generation = active_generation and local_date = quota_date
      and count < effective_cap_snapshot;
  if not found then
    raise exception 'application daily cap race lost' using errcode = '23514';
  end if;

  if next_ordinal = 1 then
    update package_approvals set
      status = 'consumed',
      consumed_at = now()
      where id = attempt_row.approval_id and status = 'active';
    if not found then
      raise exception 'approval consumption race lost' using errcode = '23514';
    end if;
  end if;

  update application_mail_attempts set
    status = 'sending',
    reservation_generation = active_generation,
    reservation_local_date = quota_date,
    current_invocation_ordinal = next_ordinal,
    provider_call_started_at = now(),
    updated_at = now()
    where id = requested_attempt_id;
  return next_ordinal;
end;
$$;

create or replace function complete_application_mail_invocation(
  requested_attempt_id uuid,
  requested_ordinal integer,
  requested_classification text,
  requested_provider_category text default null,
  requested_receipt_hash text default null
) returns integer language plpgsql as $$
declare
  attempt_row application_mail_attempts%rowtype;
begin
  if requested_classification not in (
    'provider_accepted', 'unknown', 'needs_user', 'retryable', 'terminal_failed'
  ) then
    raise exception 'invalid invocation classification' using errcode = '23514';
  end if;
  select * into attempt_row from application_mail_attempts
    where id = requested_attempt_id for update;
  if not found
    or attempt_row.status <> 'sending'
    or attempt_row.current_invocation_ordinal <> requested_ordinal then
    return 0;
  end if;
  perform 1 from users
    where id = attempt_row.user_id and deleting_at is null for update;
  if not found then
    return 0;
  end if;
  update application_mail_invocations set
    finished_at = now(),
    classification = requested_classification,
    provider_category = requested_provider_category,
    receipt_hash = requested_receipt_hash
    where attempt_id = requested_attempt_id
      and ordinal = requested_ordinal
      and finished_at is null;
  if not found then
    return 0;
  end if;
  update application_mail_attempts set
    status = requested_classification,
    provider_call_started_at = case
      when requested_classification in ('needs_user', 'retryable') then null
      else provider_call_started_at
    end,
    provider_acceptance_hash = case
      when requested_classification = 'provider_accepted' then requested_receipt_hash
      else null
    end,
    terminal_at = case
      when requested_classification in (
        'provider_accepted', 'unknown', 'terminal_failed'
      ) then now()
      else null
    end,
    updated_at = now()
    where id = requested_attempt_id and status = 'sending';
  return case when found then 1 else 0 end;
end;
$$;

create or replace function start_notification_outbox_invocation(
  requested_outbox_id uuid
) returns integer language plpgsql as $$
declare
  outbox_row notification_outbox%rowtype;
begin
  select * into outbox_row from notification_outbox where id = requested_outbox_id;
  if not found then
    return 0;
  end if;
  perform 1 from users where id = outbox_row.user_id and deleting_at is null for update;
  if not found then
    return 0;
  end if;
  select * into outbox_row from notification_outbox
    where id = requested_outbox_id for update;
  if outbox_row.status <> 'claimed' or outbox_row.invocation_ordinal <> 0
    or outbox_row.lease_expires_at <= now() then
    raise exception 'outbox is not claimable' using errcode = '23514';
  end if;
  insert into notification_outbox_invocations (
    outbox_id, user_id, ordinal, started_at
  ) values (outbox_row.id, outbox_row.user_id, 1, now());
  update notification_outbox set
    status = 'sending',
    invocation_ordinal = 1,
    provider_call_started_at = now(),
    lease_owner = null,
    lease_expires_at = null,
    updated_at = now()
    where id = requested_outbox_id;
  return 1;
end;
$$;

create or replace function complete_notification_outbox_invocation(
  requested_outbox_id uuid,
  requested_classification text,
  requested_receipt_hash text default null
) returns integer language plpgsql as $$
declare
  outbox_row notification_outbox%rowtype;
  completed_at timestamptz := now();
begin
  if requested_classification not in (
    'provider_accepted', 'failed', 'unknown', 'needs_user'
  ) then
    raise exception 'invalid outbox classification' using errcode = '23514';
  end if;
  select * into outbox_row from notification_outbox
    where id = requested_outbox_id for update;
  if not found or outbox_row.status <> 'sending'
    or outbox_row.invocation_ordinal <> 1 then
    return 0;
  end if;
  perform 1 from users
    where id = outbox_row.user_id and deleting_at is null for update;
  if not found then
    return 0;
  end if;
  update notification_outbox_invocations set
    finished_at = completed_at,
    classification = requested_classification,
    receipt_hash = requested_receipt_hash
    where outbox_id = requested_outbox_id and finished_at is null;
  if not found then
    return 0;
  end if;
  update notification_outbox set
    status = requested_classification,
    classification = requested_classification,
    receipt_hash = requested_receipt_hash,
    terminal_at = completed_at,
    purge_after = completed_at + interval '30 days',
    updated_at = completed_at
    where id = requested_outbox_id and status = 'sending';
  if found and outbox_row.aggregate_type = 'digest_run' then
    update digest_runs set
      status = requested_classification,
      updated_at = completed_at
      where id = outbox_row.aggregate_id
        and user_id = outbox_row.user_id
        and status = 'queued';
  end if;
  return case when found then 1 else 0 end;
end;
$$;

create or replace function begin_user_workflow_deletion(requested_user_id uuid)
returns integer language plpgsql as $$
declare
  barrier_at timestamptz := now();
begin
  update users set deleting_at = coalesce(deleting_at, barrier_at)
    where id = requested_user_id;
  if not found then
    return 0;
  end if;
  update email_connections set
    status = 'disabled',
    refresh_ciphertext = null,
    key_version = null,
    refresh_nonce = null,
    refresh_tag = null,
    disabled_at = barrier_at,
    updated_at = barrier_at
    where user_id = requested_user_id and status <> 'disabled';
  update application_mail_attempts set
    status = 'canceled',
    provider_call_started_at = null,
    terminal_at = barrier_at,
    updated_at = barrier_at
    where user_id = requested_user_id
      and status in ('queued', 'reserved', 'retryable', 'needs_user');
  update application_mail_invocations i set
    finished_at = barrier_at,
    classification = 'unknown',
    provider_category = 'account_deletion'
    from application_mail_attempts a
    where a.id = i.attempt_id
      and a.user_id = requested_user_id
      and a.status = 'sending'
      and i.finished_at is null;
  update application_mail_attempts set
    status = 'unknown',
    terminal_at = barrier_at,
    updated_at = barrier_at
    where user_id = requested_user_id and status = 'sending';
  update notification_outbox set
    status = 'canceled',
    terminal_at = barrier_at,
    purge_after = barrier_at + interval '30 days',
    lease_owner = null,
    lease_expires_at = null,
    updated_at = barrier_at
    where user_id = requested_user_id and status in ('pending', 'claimed');
  update notification_outbox_invocations i set
    finished_at = barrier_at,
    classification = 'unknown'
    from notification_outbox o
    where o.id = i.outbox_id
      and o.user_id = requested_user_id
      and o.status = 'sending'
      and i.finished_at is null;
  update notification_outbox set
    status = 'unknown',
    classification = 'unknown',
    terminal_at = barrier_at,
    purge_after = barrier_at + interval '30 days',
    updated_at = barrier_at
    where user_id = requested_user_id and status = 'sending';
  return 1;
end;
$$;

create or replace function erase_mail_credentials_before_user_delete()
returns trigger language plpgsql as $$
begin
  update email_connections set
    status = 'disabled',
    refresh_ciphertext = null,
    key_version = null,
    refresh_nonce = null,
    refresh_tag = null,
    disabled_at = coalesce(disabled_at, now()),
    updated_at = now()
    where user_id = old.id and status <> 'disabled';
  return old;
end;
$$;

drop trigger if exists users_erase_mail_credentials on users;
create trigger users_erase_mail_credentials before delete on users
for each row execute function erase_mail_credentials_before_user_delete();

-- Forward-compatible rollback procedure:
-- 1. Disable Apply/digest claims and both mailbox provider kill switches.
-- 2. Deploy the previous application release; it ignores this expanded schema.
-- 3. Retain every immutable ledger/table/function so in-flight classifications,
--    cooldowns, quota consumption, and unknown outcomes are not erased.
-- 4. Correct defects with a later forward migration. Never down-migrate or
--    requeue a sending/unknown row merely to make an older release writable.
