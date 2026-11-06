-- Durable scheduling/claim ledger for the isolated Jobs workflow queues.

create table if not exists job_work_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in (
    'jobs_match', 'jobs_digest', 'application_package'
  )),
  aggregate_id uuid not null,
  payload_version integer not null default 1 check (payload_version > 0),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  status text not null default 'pending' check (status in (
    'pending', 'claimed', 'completed', 'canceled', 'retryable', 'unknown', 'terminal_failed'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  result_reference_id uuid,
  failure_category text check (
    failure_category is null or (
      char_length(failure_category) between 1 and 80
      and failure_category !~ '(ya29\.|eyJ[A-Za-z0-9_-])'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  terminal_at timestamptz,
  unique (kind, dedupe_key),
  unique (id, kind, payload_version),
  check (
    (status = 'claimed' and lease_owner is not null and lease_expires_at is not null
      and heartbeat_at is not null and terminal_at is null)
    or
    (status <> 'claimed' and lease_owner is null and lease_expires_at is null)
  ),
  check (
    (status in ('completed', 'canceled', 'unknown', 'terminal_failed') and terminal_at is not null)
    or
    (status in ('pending', 'claimed', 'retryable') and terminal_at is null)
  )
);

create index if not exists job_work_items_claim_idx
  on job_work_items(kind, available_at, created_at)
  where status in ('pending', 'claimed', 'retryable');

create or replace function enforce_job_work_item_transition()
returns trigger language plpgsql as $$
declare legal boolean := false;
begin
  if old.status = new.status then return new; end if;
  legal := (old.status in ('pending', 'retryable') and new.status in ('claimed', 'canceled'))
    or (old.status = 'claimed' and new.status in (
      'completed', 'canceled', 'retryable', 'unknown', 'terminal_failed'
    ));
  if not legal then
    raise exception 'illegal job_work_items transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists job_work_items_transition on job_work_items;
create trigger job_work_items_transition before update of status on job_work_items
for each row execute function enforce_job_work_item_transition();

-- Email-version identity is immutable, but the previous version must be able
-- to record a one-way supersession timestamp when the verified account email changes.
drop trigger if exists account_email_versions_immutable on account_email_versions;
drop trigger if exists account_email_versions_identity_immutable on account_email_versions;
create trigger account_email_versions_identity_immutable
before update of id,user_id,version,normalized_email,verification_source,verified_at,created_at
on account_email_versions for each row execute function reject_immutable_workflow_row();

create or replace function enforce_account_email_supersession()
returns trigger language plpgsql as $$
begin
  if old.superseded_at is not null or new.superseded_at is null
    or new.superseded_at < old.verified_at then
    raise exception 'account email supersession is one-way' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists account_email_versions_supersession on account_email_versions;
create trigger account_email_versions_supersession
before update of superseded_at on account_email_versions
for each row when (old.superseded_at is distinct from new.superseded_at)
execute function enforce_account_email_supersession();

create table if not exists application_package_attachments (
  package_id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  bytes bytea not null check (octet_length(bytes) between 1 and 10485760),
  bytes_hash text not null check (bytes_hash ~ '^[0-9a-f]{64}$'),
  media_type text not null default 'application/pdf' check (media_type = 'application/pdf'),
  filename text not null check (char_length(filename) between 1 and 180),
  created_at timestamptz not null default now(),
  foreign key (package_id,user_id) references application_packages(id,user_id) on delete cascade,
  unique (package_id,user_id,bytes_hash)
);

drop trigger if exists application_package_attachments_immutable on application_package_attachments;
create trigger application_package_attachments_immutable
before update on application_package_attachments
for each row execute function reject_immutable_workflow_row();
