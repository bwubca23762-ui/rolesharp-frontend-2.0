-- Send-only mailbox credentials, immutable packages, and at-most-once ledger.
-- SIZE_OK: declarative DDL for one ordered migration; splitting would expose
-- partially constrained mail ledgers between migrator checkpoints.

create extension if not exists pgcrypto;

create table if not exists oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  session_hash text not null check (session_hash ~ '^[0-9a-f]{64}$'),
  state_hash text not null check (state_hash ~ '^[0-9a-f]{64}$'),
  nonce_hash text not null check (nonce_hash ~ '^[0-9a-f]{64}$'),
  pkce_ciphertext bytea not null check (
    octet_length(pkce_ciphertext) >= 16
    and encode(pkce_ciphertext, 'escape') !~ '^(ya29\.|eyJ[A-Za-z0-9_-])'
  ),
  pkce_key_version integer not null check (pkce_key_version > 0),
  pkce_nonce bytea not null check (octet_length(pkce_nonce) = 12),
  pkce_tag bytea not null check (octet_length(pkce_tag) = 16),
  redirect_uri text not null,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  check (
    (status = 'pending' and consumed_at is null)
    or (status = 'consumed' and consumed_at is not null and consumed_at <= expires_at)
    or (status = 'expired' and consumed_at is null)
  ),
  unique (state_hash)
);

create table if not exists oauth_state_tombstones (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  terminal_status text not null check (terminal_status in ('consumed', 'expired')),
  retain_until timestamptz not null,
  created_at timestamptz not null default now(),
  check (retain_until = created_at + interval '24 hours')
);

create table if not exists email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  provider_tenant text not null,
  provider_subject text not null,
  verified_sender text not null check (
    verified_sender = lower(btrim(verified_sender))
    and verified_sender ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  granted_scopes text[] not null,
  refresh_ciphertext bytea,
  key_version integer,
  refresh_nonce bytea,
  refresh_tag bytea,
  refresh_aad text generated always as (
    case when key_version is null then null else
      'rolesharp-mail-v1|user=' || user_id::text
      || '|connection=' || id::text
      || '|provider=' || provider
      || '|tenant=' || provider_tenant
      || '|subject=' || provider_subject
      || '|generation=' || connection_generation::text
      || '|key=' || key_version::text
    end
  ) stored,
  connection_generation integer not null check (connection_generation > 0),
  status text not null default 'active' check (status in ('active', 'needs_user', 'disabled')),
  disabled_at timestamptz,
  revocation_result text check (
    revocation_result is null
    or (
      char_length(revocation_result) <= 256
      and revocation_result !~ '(ya29\.|eyJ[A-Za-z0-9_-])'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (provider = 'google' and provider_tenant = 'google')
    or (provider = 'microsoft' and provider_tenant ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
  ),
  check (provider_subject = btrim(provider_subject) and provider_subject <> ''),
  check (
    (provider = 'google'
      and granted_scopes @> array['openid', 'email', 'https://www.googleapis.com/auth/gmail.send']::text[]
      and not (granted_scopes && array[
        'https://mail.google.com/',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ]::text[]))
    or
    (provider = 'microsoft'
      and granted_scopes @> array['openid', 'offline_access', 'User.Read', 'Mail.Send']::text[]
      and not (granted_scopes && array['Mail.Read', 'Mail.ReadWrite']::text[]))
  ),
  check (
    (status <> 'disabled'
      and refresh_ciphertext is not null and octet_length(refresh_ciphertext) >= 48
      and substring(refresh_ciphertext from 1 for 32) = digest(refresh_aad, 'sha256')
      and encode(refresh_ciphertext, 'escape') !~ '^(ya29\.|eyJ[A-Za-z0-9_-])'
      and key_version is not null and key_version > 0
      and refresh_nonce is not null and octet_length(refresh_nonce) = 12
      and refresh_tag is not null and octet_length(refresh_tag) = 16
      and disabled_at is null)
    or
    (status = 'disabled'
      and refresh_ciphertext is null and key_version is null
      and refresh_nonce is null and refresh_tag is null
      and disabled_at is not null)
  ),
  unique (id, user_id),
  unique (id, user_id, connection_generation)
);

create unique index if not exists email_connections_live_mailbox_identity
  on email_connections (provider, provider_tenant, provider_subject)
  where status <> 'disabled';

do $$
begin
  if not exists (
    select 1 from pg_constraint
      where conname = 'job_campaigns_pinned_connection_owner_fk'
        and conrelid = 'job_campaigns'::regclass
  ) then
    alter table job_campaigns
      add constraint job_campaigns_pinned_connection_owner_fk
      foreign key (pinned_connection_id, user_id)
      references email_connections(id, user_id);
  end if;
end;
$$;

-- Older authenticated resume writes populated only user_id_text. Recover
-- ownership only when that text exactly matches a real user UUID; malformed,
-- orphaned, and anonymous legacy rows deliberately remain unowned.
update resumes r
set user_id = u.id
from users u
where r.user_id is null
  and r.user_id_text is not null
  and lower(btrim(r.user_id_text)) = u.id::text;

create unique index if not exists resumes_id_user_unique
  on resumes (id, user_id);

create table if not exists application_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  canonical_job_key text not null,
  canonical_company_key text not null,
  job_snapshot_id uuid not null,
  profile_version_id uuid not null,
  resume_id uuid not null,
  template_version integer not null check (template_version > 0),
  policy_version integer not null check (policy_version > 0),
  score_version integer not null check (score_version > 0),
  extraction_version integer not null check (extraction_version > 0),
  connection_id uuid not null,
  connection_generation integer not null check (connection_generation > 0),
  recipient_record jsonb not null,
  subject text not null,
  body text not null,
  attachment_hash text not null check (attachment_hash ~ '^[0-9a-f]{64}$'),
  attachment_bytes_hash text not null check (attachment_bytes_hash ~ '^[0-9a-f]{64}$'),
  package_hash text not null check (package_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'preparing' check (
    status in ('preparing', 'review_required', 'ready', 'blocked', 'stale')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (job_snapshot_id, canonical_job_key, canonical_company_key)
    references job_snapshots(id, canonical_job_key, canonical_company_key),
  foreign key (profile_version_id, user_id)
    references career_profile_versions(id, user_id),
  foreign key (resume_id, user_id) references resumes(id, user_id),
  foreign key (connection_id, user_id, connection_generation)
    references email_connections(id, user_id, connection_generation),
  unique (package_hash),
  unique (id, user_id),
  unique (id, user_id, package_hash),
  unique (id, user_id, canonical_job_key, canonical_company_key)
);

create table if not exists package_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  package_id uuid not null,
  package_hash text not null,
  authorization_mode text not null check (authorization_mode in ('review_each', 'campaign_policy')),
  actor text not null check (actor in ('user', 'campaign_policy')),
  campaign_id uuid not null,
  campaign_consent_version integer,
  selected_recipient text not null check (
    selected_recipient = lower(btrim(selected_recipient))
    and selected_recipient ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  expires_at timestamptz not null,
  approved_at timestamptz not null default now(),
  status text not null default 'active' check (
    status in ('active', 'invalidated', 'expired', 'consumed')
  ),
  invalidated_at timestamptz,
  consumed_at timestamptz,
  foreign key (package_id, user_id, package_hash)
    references application_packages(id, user_id, package_hash),
  foreign key (campaign_id, user_id) references job_campaigns(id, user_id),
  check (expires_at <= approved_at + interval '24 hours'),
  check (expires_at > approved_at),
  check (
    (authorization_mode = 'review_each' and actor = 'user')
    or
    (authorization_mode = 'campaign_policy'
      and actor = 'campaign_policy'
      and campaign_consent_version is not null)
  ),
  check (
    (status = 'active' and invalidated_at is null and consumed_at is null)
    or (status = 'invalidated' and invalidated_at is not null and consumed_at is null)
    or (status = 'expired' and invalidated_at is null and consumed_at is null)
    or (status = 'consumed' and invalidated_at is null and consumed_at is not null)
  ),
  unique (id, user_id),
  unique (id, user_id, package_id),
  unique (package_id, package_hash),
  unique (id, user_id, package_id, package_hash)
);

create table if not exists application_mail_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  canonical_job_key text not null,
  canonical_company_key text not null,
  package_id uuid not null,
  approval_id uuid not null,
  campaign_id uuid not null,
  connection_id uuid not null,
  status text not null default 'queued' check (
    status in (
      'queued', 'blocked', 'canceled', 'reserved', 'sending',
      'provider_accepted', 'unknown', 'needs_user', 'retryable', 'terminal_failed'
    )
  ),
  reservation_generation integer,
  reservation_local_date date,
  current_invocation_ordinal integer not null default 0 check (current_invocation_ordinal >= 0),
  provider_call_started_at timestamptz,
  provider_acceptance_hash text check (
    provider_acceptance_hash is null or provider_acceptance_hash ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  terminal_at timestamptz,
  foreign key (package_id, user_id, canonical_job_key, canonical_company_key)
    references application_packages(id, user_id, canonical_job_key, canonical_company_key),
  foreign key (approval_id, user_id, package_id)
    references package_approvals(id, user_id, package_id),
  foreign key (campaign_id, user_id) references job_campaigns(id, user_id),
  foreign key (connection_id, user_id) references email_connections(id, user_id),
  unique (user_id, canonical_job_key),
  unique (id, user_id),
  unique (id, user_id, canonical_company_key),
  check (
    (status = 'sending' and provider_call_started_at is not null
      and provider_acceptance_hash is null and terminal_at is null)
    or
    (status = 'provider_accepted' and provider_acceptance_hash is not null
      and terminal_at is not null)
    or
    (status in ('unknown', 'terminal_failed', 'blocked', 'canceled')
      and provider_acceptance_hash is null
      and terminal_at is not null)
    or
    (status in ('queued', 'reserved', 'needs_user', 'retryable')
      and provider_call_started_at is null and provider_acceptance_hash is null
      and terminal_at is null)
  )
);

create table if not exists application_mail_invocations (
  attempt_id uuid not null,
  user_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  policy_generation integer not null check (policy_generation > 0),
  local_date date not null,
  not_before timestamptz not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  classification text check (
    classification is null or classification in (
      'provider_accepted', 'unknown', 'needs_user', 'retryable', 'terminal_failed'
    )
  ),
  provider_category text,
  receipt_hash text check (receipt_hash is null or receipt_hash ~ '^[0-9a-f]{64}$'),
  primary key (attempt_id, ordinal),
  foreign key (attempt_id, user_id) references application_mail_attempts(id, user_id) on delete cascade,
  check (classification <> 'provider_accepted' or receipt_hash is not null),
  check ((finished_at is null) = (classification is null))
);

create table if not exists application_quota_reservations (
  attempt_id uuid not null,
  user_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  policy_generation integer not null check (policy_generation > 0),
  local_date date not null,
  effective_cap_snapshot integer not null check (effective_cap_snapshot between 1 and 10),
  reserved_at timestamptz not null default now(),
  primary key (attempt_id, ordinal),
  foreign key (attempt_id, ordinal)
    references application_mail_invocations(attempt_id, ordinal) on delete cascade,
  foreign key (attempt_id, user_id)
    references application_mail_attempts(id, user_id) on delete cascade
);

create table if not exists application_daily_counters (
  user_id uuid not null references users(id) on delete cascade,
  policy_generation integer not null check (policy_generation > 0),
  local_date date not null,
  count integer not null default 0 check (count >= 0),
  effective_cap_snapshot integer not null check (effective_cap_snapshot between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, policy_generation, local_date),
  check (count <= effective_cap_snapshot)
);

create table if not exists application_company_cooldown_heads (
  user_id uuid not null references users(id) on delete cascade,
  canonical_company_key text not null references canonical_companies(canonical_company_key),
  owner_attempt_id uuid not null,
  last_consuming_at timestamptz not null,
  primary key (user_id, canonical_company_key),
  foreign key (owner_attempt_id, user_id)
    references application_mail_attempts(id, user_id) on delete cascade
);
