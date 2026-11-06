-- Separate, consent-aware communications subsystem. This intentionally does not
-- reuse the Jobs notification_outbox, whose aggregates, lifecycle, and safety
-- boundary belong only to Daily Matches.

create table if not exists communication_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null unique check (campaign_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  internal_name text not null check (char_length(internal_name) between 1 and 160),
  created_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

create table if not exists communication_campaign_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references communication_campaigns(id),
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in (
    'draft','scheduled','active','paused','completed','canceled','superseded'
  )),
  communication_class text not null check (communication_class in ('essential','marketing')),
  preference_category text not null check (preference_category in ('essential','product_updates','career_tips')),
  audience text not null check (audience in ('all_verified','free','premium','student')),
  subject text not null check (char_length(subject) between 1 and 180),
  preheader text check (preheader is null or char_length(preheader) <= 240),
  text_body text not null check (char_length(text_body) between 1 and 20000),
  html_body text not null check (char_length(html_body) between 1 and 50000),
  reply_to text check (reply_to is null or char_length(reply_to) <= 320),
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  scheduled_at timestamptz,
  enrollment_closed_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  created_by uuid references staff_accounts(id),
  published_by uuid references staff_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, version_number),
  unique (id, campaign_id),
  check (
    (communication_class='essential' and preference_category='essential')
    or (communication_class='marketing' and preference_category in ('product_updates','career_tips'))
  ),
  check (
    (status='draft' and activated_at is null and completed_at is null and canceled_at is null)
    or (status='scheduled' and scheduled_at is not null and activated_at is null and completed_at is null and canceled_at is null)
    or (status in ('active','paused') and activated_at is not null and completed_at is null and canceled_at is null)
    or (status in ('completed','superseded') and activated_at is not null and completed_at is not null and canceled_at is null)
    or (status='canceled' and canceled_at is not null)
  )
);

create unique index if not exists communication_campaign_one_live_version
  on communication_campaign_versions (campaign_id)
  where status in ('scheduled','active','paused');
create index if not exists communication_campaign_versions_status_idx
  on communication_campaign_versions (status, scheduled_at, created_at desc);

-- Marketing starts opted out. A positive preference is an explicit, timestamped
-- choice; essential account/service messages do not depend on marketing consent.
create table if not exists communication_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  product_updates_enabled boolean not null default false,
  product_updates_changed_at timestamptz,
  career_tips_enabled boolean not null default false,
  career_tips_changed_at timestamptz,
  source text not null default 'settings' check (source in ('settings','unsubscribe','admin_import','api')),
  updated_at timestamptz not null default now(),
  check (not product_updates_enabled or product_updates_changed_at is not null),
  check (not career_tips_enabled or career_tips_changed_at is not null)
);

-- Suppressions are append-only compliance records. Global suppressions override
-- every campaign; category suppressions override only matching marketing mail.
create table if not exists communication_suppressions (
  id uuid primary key default gen_random_uuid(),
  email_fingerprint text not null check (email_fingerprint ~ '^[0-9a-f]{64}$'),
  scope text not null check (scope in ('all','marketing','product_updates','career_tips')),
  reason text not null check (reason in ('unsubscribe','complaint','hard_bounce','invalid','admin','account_deleted')),
  source_reference text check (source_reference is null or char_length(source_reference) <= 200),
  created_at timestamptz not null default now(),
  unique (email_fingerprint, scope)
);
create index if not exists communication_suppressions_lookup_idx
  on communication_suppressions (email_fingerprint, scope);

create table if not exists communication_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_version_id uuid not null references communication_campaign_versions(id),
  campaign_id uuid not null,
  user_id uuid references users(id) on delete set null,
  recipient_email text check (recipient_email is null or char_length(recipient_email) between 3 and 320),
  email_fingerprint text not null check (email_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in (
    'pending','claimed','sending','provider_accepted','failed','unknown','suppressed','canceled'
  )),
  admission_key text not null check (char_length(admission_key) between 16 and 200),
  consent_snapshot jsonb not null,
  content_digest_snapshot text not null check (content_digest_snapshot ~ '^[0-9a-f]{64}$'),
  lease_owner text,
  lease_expires_at timestamptz,
  provider_call_started_at timestamptz,
  terminal_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_version_id, campaign_id)
    references communication_campaign_versions(id, campaign_id),
  unique (campaign_version_id, email_fingerprint),
  unique (campaign_version_id, admission_key),
  unique (id, campaign_version_id),
  check (jsonb_typeof(consent_snapshot)='object'),
  check (
    (status='claimed' and lease_owner is not null and lease_expires_at is not null and lease_expires_at>updated_at)
    or (status<>'claimed' and lease_owner is null and lease_expires_at is null)
  ),
  check (
    (status='sending' and provider_call_started_at is not null and terminal_at is null and purge_after is null)
    or (status in ('provider_accepted','failed','unknown','suppressed','canceled') and terminal_at is not null and purge_after is not null)
    or (status in ('pending','claimed') and provider_call_started_at is null and terminal_at is null and purge_after is null)
  )
);
create index if not exists communication_recipients_claim_idx
  on communication_recipients (created_at, id)
  where status in ('pending','claimed');
create index if not exists communication_recipients_campaign_status_idx
  on communication_recipients (campaign_version_id, status);
create index if not exists communication_recipients_user_idx
  on communication_recipients (user_id, created_at desc) where user_id is not null;

-- Exactly one provider boundary per recipient. Once the boundary starts, any
-- ambiguous exception becomes unknown and is never automatically retried.
create table if not exists communication_attempts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null unique,
  campaign_version_id uuid not null,
  ordinal integer not null default 1 check (ordinal=1),
  status text not null check (status in ('sending','provider_accepted','failed','unknown')),
  transport text not null check (transport in ('local_sink','provider')),
  provider_message_id_hash text check (provider_message_id_hash is null or provider_message_id_hash ~ '^[0-9a-f]{64}$'),
  receipt_hash text check (receipt_hash is null or receipt_hash ~ '^[0-9a-f]{64}$'),
  provider_category text check (provider_category is null or char_length(provider_category) <= 120),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (recipient_id, campaign_version_id)
    references communication_recipients(id, campaign_version_id),
  check ((status='sending')=(finished_at is null)),
  check (status<>'provider_accepted' or receipt_hash is not null)
);
create index if not exists communication_attempts_status_idx
  on communication_attempts (status, started_at desc);

create table if not exists communication_throttle_buckets (
  bucket_key text primary key check (char_length(bucket_key) between 1 and 160),
  window_started_at timestamptz not null,
  accepted_count integer not null default 0 check (accepted_count >= 0),
  updated_at timestamptz not null default now()
);

-- Runtime provider delivery is disabled by migration and cannot be enabled by
-- campaign publishing. Activation is a separate operational step after review.
create table if not exists communication_runtime_control (
  singleton boolean primary key default true check (singleton),
  transport_mode text not null default 'disabled' check (transport_mode in ('disabled','local_sink','provider')),
  globally_paused boolean not null default true,
  max_batch_size integer not null default 25 check (max_batch_size between 1 and 100),
  max_per_minute integer not null default 30 check (max_per_minute between 1 and 1000),
  max_per_day integer not null default 1000 check (max_per_day between 1 and 100000),
  updated_at timestamptz not null default now(),
  updated_by uuid references staff_accounts(id)
);
insert into communication_runtime_control (singleton) values (true) on conflict do nothing;

create or replace function reject_immutable_communication_row()
returns trigger language plpgsql as $$
begin
  raise exception '% is immutable', tg_table_name using errcode='55000';
end;
$$;

create or replace function enforce_communication_campaign_version()
returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    if old.status<>'draft' then
      raise exception 'published communication versions are immutable' using errcode='55000';
    end if;
    return old;
  end if;
  if tg_op='INSERT' then
    new.updated_at:=now();
    return new;
  end if;
  if old.status<>'draft' then
    if new.campaign_id<>old.campaign_id
      or new.version_number<>old.version_number
      or new.communication_class<>old.communication_class
      or new.preference_category<>old.preference_category
      or new.audience<>old.audience
      or new.subject<>old.subject
      or new.preheader is distinct from old.preheader
      or new.text_body<>old.text_body
      or new.html_body<>old.html_body
      or new.reply_to is distinct from old.reply_to
      or new.content_digest<>old.content_digest
      or new.scheduled_at is distinct from old.scheduled_at
      or new.created_by is distinct from old.created_by
      or new.created_at<>old.created_at then
      raise exception 'published communication version content is immutable' using errcode='55000';
    end if;
  end if;
  new.updated_at:=now();
  return new;
end;
$$;
drop trigger if exists communication_campaign_version_contract on communication_campaign_versions;
create trigger communication_campaign_version_contract
before insert or update or delete on communication_campaign_versions
for each row execute function enforce_communication_campaign_version();

create or replace function enforce_communication_recipient_identity()
returns trigger language plpgsql as $$
begin
  if new.campaign_version_id<>old.campaign_version_id
    or new.campaign_id<>old.campaign_id
    or (new.recipient_email is distinct from old.recipient_email and new.recipient_email is not null)
    or new.email_fingerprint<>old.email_fingerprint
    or new.admission_key<>old.admission_key
    or new.consent_snapshot<>old.consent_snapshot
    or new.content_digest_snapshot<>old.content_digest_snapshot
    or new.created_at<>old.created_at then
    raise exception 'communication recipient snapshot is immutable' using errcode='55000';
  end if;
  new.updated_at:=now();
  return new;
end;
$$;
drop trigger if exists communication_recipient_identity on communication_recipients;
create trigger communication_recipient_identity
before update on communication_recipients
for each row execute function enforce_communication_recipient_identity();

drop trigger if exists communication_attempts_immutable on communication_attempts;
create trigger communication_attempts_immutable
before delete on communication_attempts
for each row execute function reject_immutable_communication_row();

create or replace function enforce_communication_attempt_completion()
returns trigger language plpgsql as $$
begin
  if old.status<>'sending' then
    raise exception 'communication attempt is already terminal' using errcode='55000';
  end if;
  if new.recipient_id<>old.recipient_id
    or new.campaign_version_id<>old.campaign_version_id
    or new.ordinal<>old.ordinal
    or new.transport<>old.transport
    or new.started_at<>old.started_at then
    raise exception 'communication attempt identity is immutable' using errcode='55000';
  end if;
  if new.status='sending' or new.finished_at is null then
    raise exception 'communication attempt completion required' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists communication_attempt_completion on communication_attempts;
create trigger communication_attempt_completion
before update on communication_attempts
for each row execute function enforce_communication_attempt_completion();

drop trigger if exists communication_suppressions_immutable on communication_suppressions;
create trigger communication_suppressions_immutable
before update or delete on communication_suppressions
for each row execute function reject_immutable_communication_row();
