-- Durable, versioned inputs and URL-first canonical job identity.
-- Expand-only: application code may adopt these tables after this migration.

alter table users add column if not exists deleting_at timestamptz;

create table if not exists career_profile_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  version integer not null check (version > 0),
  normalized_facts jsonb not null,
  provenance jsonb not null,
  facts_hash text not null check (facts_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (user_id, version),
  unique (id, user_id),
  unique (id, user_id, version)
);

create table if not exists account_email_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  version integer not null check (version > 0),
  normalized_email text not null check (
    normalized_email = lower(btrim(normalized_email))
    and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  verification_source text not null check (verification_source in ('account', 'email_challenge', 'admin')),
  verified_at timestamptz not null,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  check (superseded_at is null or superseded_at >= verified_at),
  unique (user_id, version),
  unique (id, user_id),
  unique (id, user_id, version)
);

create table if not exists canonical_companies (
  canonical_company_key text primary key check (
    canonical_company_key ~ '^(employer|domain):[0-9a-z._:-]+$'
  ),
  verified_employer_id text,
  verified_domain text,
  identity_confidence integer not null check (identity_confidence between 0 and 10000),
  identity_state text not null check (identity_state in ('verified', 'ambiguous', 'conflicted')),
  automation_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (verified_employer_id is not null or verified_domain is not null)
    and (identity_state = 'verified' or automation_blocked)
  ),
  unique (canonical_company_key, identity_state, automation_blocked)
);

create table if not exists canonical_jobs (
  canonical_job_key text primary key check (canonical_job_key ~ '^(url|provider):[0-9a-z:_-]+$'),
  canonical_company_key text not null references canonical_companies(canonical_company_key),
  key_kind text not null check (key_kind in ('verified_url_hash', 'provider_fallback')),
  official_url_hash text check (official_url_hash is null or official_url_hash ~ '^[0-9a-f]{64}$'),
  url_policy_version integer not null default 1 check (url_policy_version > 0),
  merge_state text not null default 'canonical' check (merge_state in ('canonical', 'merged', 'conflicted')),
  automation_blocked boolean not null default false,
  merged_into_key text references canonical_jobs(canonical_job_key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (key_kind = 'verified_url_hash'
      and official_url_hash is not null
      and canonical_job_key = 'url:' || official_url_hash)
    or
    (key_kind = 'provider_fallback'
      and official_url_hash is null
      and canonical_job_key like 'provider:%')
  ),
  check (
    (merge_state = 'merged' and merged_into_key is not null and automation_blocked)
    or
    (merge_state <> 'merged' and merged_into_key is null)
  ),
  check (merge_state <> 'conflicted' or automation_blocked),
  unique (canonical_job_key, canonical_company_key),
  unique (canonical_job_key, merge_state, automation_blocked)
);

create unique index if not exists canonical_jobs_official_url_unique
  on canonical_jobs (official_url_hash)
  where official_url_hash is not null and merge_state <> 'merged';

create table if not exists canonical_job_aliases (
  provider_namespace text not null,
  provider_job_id text not null,
  canonical_job_key text not null references canonical_jobs(canonical_job_key),
  verified_official_url_hash text check (
    verified_official_url_hash is null or verified_official_url_hash ~ '^[0-9a-f]{64}$'
  ),
  url_policy_version integer not null default 1 check (url_policy_version > 0),
  created_at timestamptz not null default now(),
  primary key (provider_namespace, provider_job_id),
  unique (provider_namespace, provider_job_id, canonical_job_key)
);

create table if not exists canonical_job_conflicts (
  id uuid primary key default gen_random_uuid(),
  official_url_hash text not null check (official_url_hash ~ '^[0-9a-f]{64}$'),
  left_canonical_job_key text not null references canonical_jobs(canonical_job_key),
  right_canonical_job_key text not null references canonical_jobs(canonical_job_key),
  state text not null default 'open' check (state in ('open', 'reconciled')),
  survivor_canonical_job_key text references canonical_jobs(canonical_job_key),
  reason text not null,
  created_at timestamptz not null default now(),
  reconciled_at timestamptz,
  check (left_canonical_job_key < right_canonical_job_key),
  check (
    (state = 'open' and survivor_canonical_job_key is null and reconciled_at is null)
    or
    (state = 'reconciled' and survivor_canonical_job_key in (
      left_canonical_job_key, right_canonical_job_key
    ) and reconciled_at is not null)
  ),
  unique (left_canonical_job_key, right_canonical_job_key)
);

create table if not exists job_snapshots (
  id uuid primary key default gen_random_uuid(),
  canonical_job_key text not null,
  canonical_company_key text not null,
  provider_namespace text not null,
  provider_job_id text not null,
  source_url text not null,
  source_body text not null,
  source_body_hash text not null check (source_body_hash ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz not null,
  published_at timestamptz,
  expires_at timestamptz,
  facts jsonb not null,
  created_at timestamptz not null default now(),
  check (published_at is null or published_at <= captured_at + interval '5 minutes'),
  foreign key (canonical_job_key, canonical_company_key)
    references canonical_jobs(canonical_job_key, canonical_company_key),
  unique (canonical_job_key, source_body_hash, captured_at),
  unique (id, canonical_job_key),
  unique (id, canonical_job_key, canonical_company_key)
);

create table if not exists application_send_policies (
  user_id uuid primary key references users(id) on delete cascade,
  quota_timezone text not null,
  timezone_generation integer not null check (timezone_generation > 0),
  user_cap integer not null check (user_cap between 1 and 10),
  admin_cap_snapshot integer not null check (admin_cap_snapshot between 1 and 10),
  effective_cap integer generated always as (least(user_cap, admin_cap_snapshot)) stored,
  pending_quota_timezone text,
  pending_timezone_generation integer,
  next_generation_activation_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (pending_quota_timezone is null
      and pending_timezone_generation is null
      and next_generation_activation_date is null)
    or
    (pending_quota_timezone is not null
      and pending_timezone_generation = timezone_generation + 1
      and next_generation_activation_date is not null)
  ),
  unique (user_id, timezone_generation)
);

create table if not exists job_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  mode text not null check (mode in ('daily_matches', 'role_apply')),
  authorization_mode text not null check (authorization_mode in ('review_each', 'campaign_policy')),
  status text not null default 'draft' check (
    status in ('draft', 'active', 'paused', 'needs_user', 'expired', 'canceled')
  ),
  profile_version_id uuid not null,
  profile_version integer not null,
  criteria_version integer not null check (criteria_version > 0),
  criteria jsonb not null,
  timezone text not null,
  timezone_generation integer not null check (timezone_generation > 0),
  daily_time time not null,
  daily_limit integer not null check (daily_limit between 1 and 10),
  fit_score_floor integer not null check (fit_score_floor between 0 and 100),
  confidence_score_floor integer not null check (confidence_score_floor between 0 and 100),
  pinned_connection_id uuid,
  consent_version integer,
  consent_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz,
  foreign key (profile_version_id, user_id, profile_version)
    references career_profile_versions(id, user_id, version),
  check (
    (authorization_mode = 'review_each')
    or
    (mode = 'role_apply'
      and consent_version is not null
      and consent_expires_at is not null
      and consent_expires_at <= created_at + interval '30 days')
  ),
  check (mode = 'role_apply' or authorization_mode = 'review_each'),
  check (
    (mode = 'daily_matches' and fit_score_floor >= 70 and confidence_score_floor >= 60)
    or
    (mode = 'role_apply' and authorization_mode = 'review_each'
      and fit_score_floor >= 75 and confidence_score_floor >= 65)
    or
    (mode = 'role_apply' and authorization_mode = 'campaign_policy'
      and fit_score_floor >= 85 and confidence_score_floor >= 80)
  ),
  check (
    (mode = 'daily_matches' and pinned_connection_id is null
      and consent_version is null and consent_expires_at is null)
    or mode = 'role_apply'
  ),
  check ((status = 'canceled') = (canceled_at is not null)),
  unique (id, user_id),
  unique (id, user_id, profile_version_id)
);

create unique index if not exists job_campaigns_one_daily_configuration
  on job_campaigns (user_id)
  where mode = 'daily_matches' and status not in ('expired', 'canceled');

create unique index if not exists job_campaigns_one_apply_configuration
  on job_campaigns (user_id)
  where mode = 'role_apply' and status not in ('expired', 'canceled');

create table if not exists job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  campaign_id uuid not null,
  profile_version_id uuid not null,
  job_snapshot_id uuid not null,
  canonical_job_key text not null,
  canonical_company_key text not null,
  score_version integer not null check (score_version > 0),
  fit_score integer not null check (fit_score between 0 and 100),
  confidence_score integer not null check (
    confidence_score between 0 and 100 and fit_score <= confidence_score
  ),
  fit_numerator bigint not null check (fit_numerator >= 0),
  confidence_numerator bigint not null check (confidence_numerator >= 0),
  breakdown jsonb not null,
  provenance jsonb not null,
  blockers jsonb not null,
  status text not null check (status in ('eligible', 'excluded', 'consumed', 'stale')),
  ranked_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (campaign_id, user_id, profile_version_id)
    references job_campaigns(id, user_id, profile_version_id),
  foreign key (profile_version_id, user_id)
    references career_profile_versions(id, user_id),
  foreign key (job_snapshot_id, canonical_job_key, canonical_company_key)
    references job_snapshots(id, canonical_job_key, canonical_company_key),
  unique (
    user_id, campaign_id, profile_version_id, job_snapshot_id, score_version
  ),
  unique (id, user_id),
  unique (id, user_id, canonical_job_key, canonical_company_key)
);

-- Existing tracker rows remain untouched. They are untrusted legacy text until a
-- later, source-backed canonicalization explicitly links them.
insert into feature_flags(name,enabled,description) values
  ('jobs_daily_matches',false,'Schedule and deliver one daily matched-job digest'),
  ('role_apply_prepare',false,'Prepare verified application-by-email packages'),
  ('role_apply_gmail_send',false,'Permit Gmail application-email provider boundaries'),
  ('role_apply_microsoft_send',false,'Permit Microsoft application-email provider boundaries')
on conflict(name) do nothing;

alter table applications add column if not exists canonical_job_key text;
alter table applications add column if not exists canonicalized_at timestamptz;
alter table applications add column if not exists job_id uuid;
alter table applications add column if not exists provider_namespace text;
alter table applications add column if not exists provider_job_id text;
alter table applications add column if not exists source_kind text not null default 'manual';
alter table applications add column if not exists follow_up_at timestamptz;

-- Preserve historical tracker outcomes while normalizing the names used by
-- the current UI. Provider/mail execution state remains in the separate
-- immutable attempt ledger and is never folded into this recruiting outcome.
update applications set status = case status
  when 'pending' then 'saved'
  when 'shortlisted' then 'saved'
  when 'submitted' then 'applied'
  when 'screening' then 'interview'
  when 'accepted' then 'offer'
  when 'declined' then 'rejected'
  when 'withdrawn' then 'rejected'
  else status end;
update applications set status='saved'
  where status not in ('saved','applied','interview','offer','rejected');

do $$ begin
  if not exists (select 1 from pg_constraint where conname='applications_status_check') then
    alter table applications add constraint applications_status_check
      check (status in ('saved','applied','interview','offer','rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname='applications_source_kind_check') then
    alter table applications add constraint applications_source_kind_check
      check (source_kind in ('manual','jobs_index','daily_matches','application_email'));
  end if;
  if not exists (select 1 from pg_constraint where conname='applications_job_id_fk') then
    alter table applications add constraint applications_job_id_fk
      foreign key (job_id) references jobs(id) on delete set null not valid;
  end if;
end $$;

create unique index if not exists applications_user_job_unique
  on applications(user_id_text,job_id) where job_id is not null;
create unique index if not exists applications_user_provider_job_unique
  on applications(user_id_text,provider_namespace,provider_job_id)
  where provider_namespace is not null and provider_job_id is not null;
create unique index if not exists applications_user_canonical_job_unique
  on applications(user_id_text,canonical_job_key) where canonical_job_key is not null;
create index if not exists applications_user_follow_up_idx
  on applications(user_id_text,follow_up_at) where follow_up_at is not null;
