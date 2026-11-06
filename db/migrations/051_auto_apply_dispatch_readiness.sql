-- Close the final Auto Apply race at the durable provider-call boundary.
-- New packages pin the immutable posting body/source and exact current legal
-- versions. Legacy uninvoked packages are invalidated and must be regenerated
-- and reviewed; historical provider-call receipts remain untouched.

alter table application_packages
  add column if not exists source_body_hash_snapshot text,
  add column if not exists source_url_snapshot text,
  add column if not exists legal_version_snapshot jsonb;

alter table application_packages
  drop constraint if exists application_packages_source_body_hash_snapshot_check,
  drop constraint if exists application_packages_source_url_snapshot_check,
  drop constraint if exists application_packages_legal_version_snapshot_check,
  add constraint application_packages_source_body_hash_snapshot_check check (
    source_body_hash_snapshot is null or source_body_hash_snapshot ~ '^[0-9a-f]{64}$'
  ),
  add constraint application_packages_source_url_snapshot_check check (
    source_url_snapshot is null or char_length(source_url_snapshot) between 1 and 4000
  ),
  add constraint application_packages_legal_version_snapshot_check check (
    legal_version_snapshot is null
    or (jsonb_typeof(legal_version_snapshot) = 'array' and jsonb_array_length(legal_version_snapshot) > 0)
  );

-- No pre-existing package can truthfully claim these newly introduced pins.
-- Invalidate only work that has not crossed the provider-call boundary.
update application_mail_attempts attempt
set status = case when attempt.status = 'needs_user' then 'canceled' else 'blocked' end,
    terminal_at = now(),
    updated_at = now()
from application_packages package
where package.id = attempt.package_id
  and package.source_body_hash_snapshot is null
  and attempt.current_invocation_ordinal = 0
  and attempt.status in ('queued', 'reserved', 'needs_user', 'retryable');

update package_approvals approval
set status = 'invalidated', invalidated_at = now()
from application_packages package
where package.id = approval.package_id
  and package.source_body_hash_snapshot is null
  and approval.status = 'active';

update application_packages
set status = 'stale', updated_at = now()
where source_body_hash_snapshot is null
  and status in ('review_required', 'ready');

-- Extend the immutable package contract to cover the new review facts.
drop trigger if exists application_packages_immutable on application_packages;
create trigger application_packages_immutable
before update of user_id, canonical_job_key, canonical_company_key, job_snapshot_id,
  profile_version_id, resume_id, template_version, policy_version, score_version,
  extraction_version, connection_id, connection_generation, recipient_record,
  subject, body, attachment_hash, attachment_bytes_hash, package_hash,
  source_body_hash_snapshot, source_url_snapshot, legal_version_snapshot, created_at
on application_packages
for each row execute function reject_immutable_workflow_row();

create or replace function enforce_auto_apply_dispatch_readiness()
returns trigger language plpgsql as $$
declare
  attempt_row application_mail_attempts%rowtype;
  package_row application_packages%rowtype;
  snapshot_row job_snapshots%rowtype;
  current_legal_snapshot jsonb;
  required_legal_count integer;
begin
  select * into attempt_row
  from application_mail_attempts
  where id = new.attempt_id and user_id = new.user_id;
  if not found or attempt_row.status <> 'reserved' then
    raise exception 'auto apply attempt is not reserved' using errcode = '23514';
  end if;

  select * into package_row
  from application_packages
  where id = attempt_row.package_id and user_id = attempt_row.user_id;
  if not found or package_row.status <> 'ready'
    or package_row.source_body_hash_snapshot is null
    or package_row.source_url_snapshot is null
    or package_row.legal_version_snapshot is null then
    raise exception 'auto apply package readiness pins are missing' using errcode = '23514';
  end if;

  select * into snapshot_row
  from job_snapshots
  where id = package_row.job_snapshot_id
    and canonical_job_key = package_row.canonical_job_key
    and canonical_company_key = package_row.canonical_company_key;
  if not found
    or snapshot_row.source_body_hash <> package_row.source_body_hash_snapshot
    or snapshot_row.source_url <> package_row.source_url_snapshot
    or snapshot_row.facts->'recipient'->>'recipient' <> 'source_backed'
    or snapshot_row.facts->'recipient'->>'emailInstruction' <> 'explicit'
    or snapshot_row.facts->'recipient'->'record'->>'disposition' <> 'auto_eligible'
    or package_row.recipient_record->>'jobSnapshotId' <> package_row.job_snapshot_id::text
    or package_row.recipient_record->>'contentHash' <> snapshot_row.source_body_hash
    or package_row.recipient_record->>'canonicalJobKey' <> package_row.canonical_job_key
    or package_row.recipient_record->>'canonicalSourceUrl' <> snapshot_row.source_url
    or (package_row.recipient_record - 'jobSnapshotId') is distinct from snapshot_row.facts->'recipient'->'record' then
    raise exception 'auto apply recipient provenance is not posting-backed' using errcode = '23514';
  end if;

  select count(*)::integer into required_legal_count
  from legal_documents where required_at_signup = true;

  with current_versions as (
    select distinct on (document.document_key)
      document.document_key, version.id, version.version_number, version.content_digest
    from legal_documents document
    join legal_document_versions version on version.document_key = document.document_key
    where document.required_at_signup = true
      and version.status in ('scheduled', 'published')
      and version.effective_at <= now()
    order by document.document_key, version.effective_at desc, version.version_number desc
  )
  select jsonb_agg(jsonb_build_object(
    'documentKey', document_key,
    'id', id,
    'versionNumber', version_number,
    'contentDigest', content_digest
  ) order by document_key)
  into current_legal_snapshot
  from current_versions;

  if required_legal_count = 0
    or current_legal_snapshot is null
    or jsonb_array_length(current_legal_snapshot) <> required_legal_count
    or package_row.legal_version_snapshot is distinct from current_legal_snapshot then
    raise exception 'auto apply legal version pin is not current' using errcode = '23514';
  end if;

  if exists (
    with current_versions as (
      select distinct on (document.document_key)
        document.document_key, document.acceptance_required_from,
        version.id, version.material_change
      from legal_documents document
      join legal_document_versions version on version.document_key = document.document_key
      where document.required_at_signup = true
        and version.status in ('scheduled', 'published')
        and version.effective_at <= now()
      order by document.document_key, version.effective_at desc, version.version_number desc
    )
    select 1
    from current_versions current
    join users app_user on app_user.id = attempt_row.user_id and app_user.deleting_at is null
    where (current.material_change or app_user.created_at >= current.acceptance_required_from)
      and not exists (
        select 1 from legal_acceptances acceptance
        where acceptance.user_id = app_user.id and acceptance.legal_version_id = current.id
      )
  ) then
    raise exception 'current legal acceptance is required for auto apply' using errcode = '23514';
  end if;

  perform 1
  from email_connections connection
  join users app_user
    on app_user.id = attempt_row.user_id and app_user.deleting_at is null
  join feature_flags prepare_flag
    on prepare_flag.name = 'role_apply_prepare' and prepare_flag.enabled = true
  join feature_flags send_flag
    on send_flag.name = case
      when connection.provider = 'google' then 'role_apply_gmail_send'
      else 'role_apply_microsoft_send'
    end and send_flag.enabled = true
  join feature_access_grants prepare_grant
    on prepare_grant.user_id = attempt_row.user_id
    and prepare_grant.feature_key = 'role_apply_prepare'
    and prepare_grant.state = 'approved'
    and (prepare_grant.expires_at is null or prepare_grant.expires_at > now())
  join feature_access_grants send_grant
    on send_grant.user_id = attempt_row.user_id
    and send_grant.feature_key = case
      when connection.provider = 'google' then 'role_apply_gmail'
      else 'role_apply_microsoft'
    end
    and send_grant.state = 'approved'
    and (send_grant.expires_at is null or send_grant.expires_at > now())
  where connection.id = attempt_row.connection_id
    and connection.user_id = attempt_row.user_id
    and connection.status = 'active'
  for share of connection, app_user, prepare_flag, send_flag, prepare_grant, send_grant;
  if not found then
    raise exception 'auto apply feature flags or grants are not active' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists application_mail_invocations_readiness on application_mail_invocations;
create trigger application_mail_invocations_readiness
before insert on application_mail_invocations
for each row execute function enforce_auto_apply_dispatch_readiness();
