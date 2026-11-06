-- Enforce the launch policy of at most five employer-email provider calls per
-- user-local day. Historical invocation and quota snapshots remain immutable;
-- only active policy and future campaign settings are clamped.

update job_campaigns
set status = 'paused',
    updated_at = now()
where mode = 'role_apply'
  and authorization_mode = 'campaign_policy'
  and status = 'active';

update job_campaigns
set authorization_mode = 'review_each',
    consent_version = null,
    consent_expires_at = null,
    updated_at = now()
where mode = 'role_apply'
  and authorization_mode = 'campaign_policy'
  and status in ('draft', 'paused', 'needs_user');

alter table job_campaigns
  drop constraint if exists job_campaigns_daily_batch_approval_check;

alter table job_campaigns
  add constraint job_campaigns_daily_batch_approval_check
    check (mode <> 'role_apply' or authorization_mode = 'review_each');

update application_send_policies
set user_cap = least(user_cap, 5),
    admin_cap_snapshot = least(admin_cap_snapshot, 5),
    updated_at = now()
where user_cap > 5 or admin_cap_snapshot > 5;

alter table application_send_policies
  drop constraint if exists application_send_policies_user_cap_check,
  drop constraint if exists application_send_policies_admin_cap_snapshot_check;

alter table application_send_policies
  add constraint application_send_policies_user_cap_check
    check (user_cap between 1 and 5),
  add constraint application_send_policies_admin_cap_snapshot_check
    check (admin_cap_snapshot between 1 and 5);

-- Existing counters may already record historical calls above the launch cap.
-- Preserve both count and the row invariant while the provider boundary below
-- independently clamps every future reservation to five.
update application_daily_counters
set effective_cap_snapshot = greatest(count, 5),
    updated_at = now()
where effective_cap_snapshot > 5 or effective_cap_snapshot < count;

update job_campaigns
set daily_limit = 5,
    updated_at = now()
where mode = 'role_apply' and daily_limit > 5;

alter table job_campaigns
  drop constraint if exists job_campaigns_role_apply_daily_limit_check;

alter table job_campaigns
  add constraint job_campaigns_role_apply_daily_limit_check
    check (mode <> 'role_apply' or daily_limit between 1 and 5);

-- Keep the authoritative provider boundary aligned with the launch policy even
-- if a stale application process reaches this function during a rolling deploy.
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
    raise exception 'application invocation is before not_before' using errcode = '23514';
  end if;
  select * into attempt_row from application_mail_attempts where id = requested_attempt_id;
  if not found then return 0; end if;

  perform 1 from users where id = attempt_row.user_id and deleting_at is null for update;
  if not found then return 0; end if;

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
    attempt_row.user_id, active_generation, quota_date, 0, least(policy_row.effective_cap, 5)
  ) on conflict (user_id, policy_generation, local_date) do nothing;

  select count, least(effective_cap_snapshot, 5) into current_count, counter_cap
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
      and status = 'active' and mode = 'role_apply'
      and authorization_mode = 'review_each'
      and pinned_connection_id = attempt_row.connection_id
    for update;
  if not found then
    raise exception 'campaign is not active' using errcode = '23514';
  end if;

  select * into package_row from application_packages where id = attempt_row.package_id;
  if not found then
    raise exception 'package is missing' using errcode = '23514';
  end if;

  perform 1 from email_connections c
    where c.id = attempt_row.connection_id and c.user_id = attempt_row.user_id
      and c.status = 'active' and c.id = package_row.connection_id
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
  if package_row.status <> 'ready'
    or package_row.recipient_record->>'disposition' <> 'auto_eligible'
    or nullif(package_row.recipient_record->>'employerDomainRelationship', '') is null
    or package_row.recipient_record->>'employerDomainRelationship' = 'unavailable' then
    raise exception 'package is not safe to send' using errcode = '23514';
  end if;

  perform 1 from package_approvals approval
    where approval.id = attempt_row.approval_id
      and approval.user_id = attempt_row.user_id
      and approval.package_id = attempt_row.package_id
      and approval.package_hash = package_row.package_hash
      and approval.authorization_mode = 'review_each' and approval.actor = 'user'
      and (
        (attempt_row.current_invocation_ordinal = 0 and approval.status = 'active')
        or (attempt_row.current_invocation_ordinal > 0 and approval.status = 'consumed')
      )
      and approval.expires_at > now()
      and exists (
        select 1 from jsonb_array_elements(package_row.recipient_record->'candidates') candidate
        where lower(candidate->>'email') = approval.selected_recipient
          and jsonb_typeof(candidate->'warnings') = 'array'
          and jsonb_array_length(candidate->'warnings') = 0
      )
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
      and count < least(effective_cap_snapshot, 5);
  if not found then
    raise exception 'application daily cap race lost' using errcode = '23514';
  end if;

  if next_ordinal = 1 then
    update package_approvals set status = 'consumed', consumed_at = now()
      where id = attempt_row.approval_id and status = 'active';
    if not found then
      raise exception 'approval consumption race lost' using errcode = '23514';
    end if;
  end if;

  update application_mail_attempts set
    status = 'sending', reservation_generation = active_generation,
    reservation_local_date = quota_date, current_invocation_ordinal = next_ordinal,
    provider_call_started_at = now(), updated_at = now()
    where id = requested_attempt_id;
  return next_ordinal;
end;
$$;
