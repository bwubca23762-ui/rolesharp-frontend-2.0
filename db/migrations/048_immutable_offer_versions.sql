-- Immutable configurable offer versions with exact lifecycle pinning.
-- Existing student tokens and lifetime claims are pinned to the seeded legacy v1
-- before the new NOT NULL contracts are enabled.

create extension if not exists pgcrypto;

create table if not exists offer_definitions (
  offer_key text primary key check (offer_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  audience text not null check (audience in ('student', 'alumni', 'general')),
  state text not null default 'active' check (state in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists offer_versions (
  id uuid primary key default gen_random_uuid(),
  offer_key text not null references offer_definitions(offer_key),
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'superseded')),
  public_name text not null check (char_length(btrim(public_name)) between 1 and 160),
  public_summary text not null check (char_length(btrim(public_summary)) between 1 and 1000),
  call_to_action text not null check (char_length(btrim(call_to_action)) between 1 and 120),
  terms_snapshot jsonb not null check (jsonb_typeof(terms_snapshot) = 'object'),
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  effective_at timestamptz not null,
  enrollment_ends_at timestamptz,
  published_at timestamptz,
  created_by uuid references staff_accounts(id) on delete set null,
  published_by uuid references staff_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_key, version_number),
  unique (id, offer_key, version_number),
  check (enrollment_ends_at is null or enrollment_ends_at > effective_at),
  check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status in ('scheduled', 'published', 'superseded') and published_at is not null)
  )
);

create index if not exists offer_versions_effective_idx
  on offer_versions (offer_key, effective_at desc, version_number desc)
  where status in ('scheduled', 'published');

create unique index if not exists offer_versions_scheduled_slot_unique
  on offer_versions (offer_key, effective_at)
  where status = 'scheduled';

create or replace function offer_terms_digest(snapshot jsonb)
returns text language sql immutable strict as $$
  select encode(digest(convert_to(snapshot::text, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function enforce_offer_version_contract()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'published offer versions are immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.content_digest <> offer_terms_digest(new.terms_snapshot) then
      raise exception 'offer version digest mismatch' using errcode = '23514';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.offer_key <> old.offer_key or new.version_number <> old.version_number then
    raise exception 'offer version identity is immutable' using errcode = '55000';
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'scheduled', 'published') then
    raise exception 'invalid offer version status transition' using errcode = '23514';
  end if;
  if old.status <> 'draft' then
    if not (
      (old.status = 'scheduled' and new.status in ('scheduled', 'published', 'superseded'))
      or (old.status = 'published' and new.status in ('published', 'superseded'))
      or (old.status = 'superseded' and new.status = 'superseded')
    ) then
      raise exception 'invalid offer version status transition' using errcode = '23514';
    end if;
    if new.public_name <> old.public_name
       or new.public_summary <> old.public_summary
       or new.call_to_action <> old.call_to_action
       or new.terms_snapshot <> old.terms_snapshot
       or new.content_digest <> old.content_digest
       or new.effective_at <> old.effective_at
       or new.enrollment_ends_at is distinct from old.enrollment_ends_at
       or new.created_by is distinct from old.created_by
       or new.published_by is distinct from old.published_by
       or new.published_at is distinct from old.published_at
       or new.created_at <> old.created_at then
      raise exception 'published offer version content is immutable' using errcode = '55000';
    end if;
  end if;

  if new.content_digest <> offer_terms_digest(new.terms_snapshot) then
    raise exception 'offer version digest mismatch' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists offer_versions_contract on offer_versions;
create trigger offer_versions_contract
before insert or update or delete on offer_versions
for each row execute function enforce_offer_version_contract();

insert into offer_definitions (offer_key, title, description, audience)
values (
  'student_premium',
  'Student Premium',
  'Verified academic-email offer with one lifetime claim per normalized student email and account.',
  'student'
)
on conflict (offer_key) do nothing;

with legacy_terms as (
  select jsonb_build_object(
    'schemaVersion', 1,
    'eligibility', jsonb_build_object(
      'kind', 'verified_academic_email',
      'lifetimeClaimsPerNormalizedEmail', 1,
      'lifetimeClaimsPerAccount', 1
    ),
    'grant', jsonb_build_object(
      'kind', 'premium_days',
      'days', 180,
      'premiumSource', 'student'
    ),
    'benefits', jsonb_build_object(
      'tailoredResumesPerMonth', 5,
      'features', jsonb_build_array(
        'premium_writing_model',
        'cover_letters',
        'interview_prep',
        'docx_export',
        'all_templates'
      )
    ),
    'verification', jsonb_build_object('tokenTtlHours', 24)
  ) as snapshot
)
insert into offer_versions (
  offer_key, version_number, status, public_name, public_summary, call_to_action,
  terms_snapshot, content_digest, effective_at, published_at
)
select
  'student_premium',
  1,
  'published',
  'Student Premium',
  '6 months of RoleSharp Premium, free for verified students.',
  'Activate 6 months free',
  snapshot,
  offer_terms_digest(snapshot),
  timestamp with time zone '1970-01-01 00:00:00+00',
  now()
from legacy_terms
on conflict (offer_key, version_number) do nothing;

alter table student_verification_tokens
  add column if not exists offer_version_id uuid references offer_versions(id),
  add column if not exists offer_key text,
  add column if not exists offer_version_number integer,
  add column if not exists offer_content_digest_snapshot text,
  add column if not exists offer_terms_snapshot jsonb;

alter table student_claims
  add column if not exists offer_version_id uuid references offer_versions(id),
  add column if not exists offer_key text,
  add column if not exists offer_version_number integer,
  add column if not exists offer_content_digest_snapshot text,
  add column if not exists offer_terms_snapshot jsonb;

-- Defined here, ahead of every UPDATE below, and not next to the triggers that
-- use it further down. A database that already has the triggers installed runs
-- this file top to bottom: if the function were still defined after the UPDATEs,
-- a rerun would fire the OLD function on the UPDATE at "backfill the grant
-- pointers" and abort before ever reaching the corrected definition. A migration
-- cannot repair a broken trigger that runs before its own fix. CREATE OR REPLACE
-- FUNCTION only syntax-checks a plpgsql body, so nothing it references has to
-- exist yet -- the position is free, the ordering is not.
--
-- Only ever attached to student_verification_tokens and student_claims (below).
-- student_grants is covered by student_grants_append_only, which rejects every
-- UPDATE and DELETE outright -- strictly stronger than a pin check. Do not add a
-- tg_table_name = 'student_grants' branch referencing student_email_fingerprint /
-- granted_at / premium_*: PL/pgSQL resolves every field in the IF expression
-- against the actual row type before the guard is evaluated, so naming a
-- student_grants-only column here makes the function raise
--   record "new" has no field "student_email_fingerprint"
-- on every UPDATE of the two tables that do use it.
create or replace function enforce_student_offer_pin_immutability()
returns trigger language plpgsql as $$
begin
  if new.offer_version_id <> old.offer_version_id
     or new.offer_key <> old.offer_key
     or new.offer_version_number <> old.offer_version_number
     or new.offer_content_digest_snapshot <> old.offer_content_digest_snapshot
     or new.offer_terms_snapshot <> old.offer_terms_snapshot then
    raise exception 'student offer version pin is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

update student_verification_tokens token
set offer_version_id = version.id,
    offer_key = version.offer_key,
    offer_version_number = version.version_number,
    offer_content_digest_snapshot = version.content_digest,
    offer_terms_snapshot = version.terms_snapshot
from offer_versions version
where version.offer_key = 'student_premium'
  and version.version_number = 1
  and token.offer_version_id is null;

update student_claims claim
set offer_version_id = version.id,
    offer_key = version.offer_key,
    offer_version_number = version.version_number,
    offer_content_digest_snapshot = version.content_digest,
    offer_terms_snapshot = version.terms_snapshot
from offer_versions version
where version.offer_key = 'student_premium'
  and version.version_number = 1
  and claim.offer_version_id is null;

alter table student_verification_tokens
  alter column offer_version_id set not null,
  alter column offer_key set not null,
  alter column offer_version_number set not null,
  alter column offer_content_digest_snapshot set not null,
  alter column offer_terms_snapshot set not null;

alter table student_claims
  alter column offer_version_id set not null,
  alter column offer_key set not null,
  alter column offer_version_number set not null,
  alter column offer_content_digest_snapshot set not null,
  alter column offer_terms_snapshot set not null;

do $$ begin
  alter table student_verification_tokens
    add constraint student_verification_tokens_offer_identity_fk
    foreign key (offer_key, offer_version_number)
    references offer_versions(offer_key, version_number);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table student_verification_tokens
    add constraint student_verification_tokens_offer_exact_fk
    foreign key (offer_version_id, offer_key, offer_version_number)
    references offer_versions(id, offer_key, version_number);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table student_claims
    add constraint student_claims_offer_identity_fk
    foreign key (offer_key, offer_version_number)
    references offer_versions(offer_key, version_number);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table student_claims
    add constraint student_claims_offer_exact_fk
    foreign key (offer_version_id, offer_key, offer_version_number)
    references offer_versions(id, offer_key, version_number);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table student_verification_tokens
    add constraint student_verification_tokens_offer_digest_check
    check (offer_content_digest_snapshot ~ '^[0-9a-f]{64}$' and jsonb_typeof(offer_terms_snapshot) = 'object');
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table student_claims
    add constraint student_claims_offer_digest_check
    check (offer_content_digest_snapshot ~ '^[0-9a-f]{64}$' and jsonb_typeof(offer_terms_snapshot) = 'object');
exception when duplicate_object then null;
end $$;

create index if not exists student_verification_tokens_offer_version_idx
  on student_verification_tokens (offer_version_id, created_at desc);
create index if not exists student_claims_offer_version_idx
  on student_claims (offer_version_id, claimed_at desc);

create table if not exists student_grants (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_email_fingerprint text not null check (student_email_fingerprint ~ '^[0-9a-f]{64}$'),
  offer_version_id uuid not null references offer_versions(id),
  offer_key text not null,
  offer_version_number integer not null check (offer_version_number > 0),
  offer_content_digest_snapshot text not null check (offer_content_digest_snapshot ~ '^[0-9a-f]{64}$'),
  offer_terms_snapshot jsonb not null check (jsonb_typeof(offer_terms_snapshot) = 'object'),
  granted_at timestamptz not null default now(),
  premium_started_at timestamptz not null,
  premium_until timestamptz not null check (premium_until > premium_started_at),
  created_at timestamptz not null default now(),
  unique (student_email),
  unique (student_email_fingerprint),
  foreign key (offer_key, offer_version_number)
    references offer_versions(offer_key, version_number),
  foreign key (offer_version_id, offer_key, offer_version_number)
    references offer_versions(id, offer_key, version_number)
);

create index if not exists student_grants_offer_version_idx on student_grants (offer_version_id, granted_at desc);

insert into student_grants (
  student_email, student_email_fingerprint, offer_version_id, offer_key, offer_version_number,
  offer_content_digest_snapshot, offer_terms_snapshot, granted_at,
  premium_started_at, premium_until
)
select
  claim.student_email,
  encode(digest(convert_to(claim.student_email, 'UTF8'), 'sha256'), 'hex'),
  claim.offer_version_id,
  claim.offer_key,
  claim.offer_version_number,
  claim.offer_content_digest_snapshot,
  claim.offer_terms_snapshot,
  claim.claimed_at,
  claim.claimed_at,
  users.premium_until
from student_claims claim
join users on users.id::text = claim.user_id
where users.premium_source = 'student'
  and users.premium_until is not null
  and users.premium_until > claim.claimed_at
  -- Replay-safe idempotency: migration 075 later drops the
  -- student_grants(student_email) UNIQUE constraint this ON CONFLICT relied
  -- on, so the runner re-executing this backfill crashed with "no unique or
  -- exclusion constraint matching the ON CONFLICT specification". A NOT
  -- EXISTS guard works with or without the constraint.
  and not exists (select 1 from student_grants g where g.student_email = claim.student_email);

alter table student_claims
  add column if not exists warn30_sent_for_grant_id uuid,
  add column if not exists expired_sent_for_grant_id uuid,
  add column if not exists winback_sent_for_grant_id uuid;

-- `grant` is a reserved keyword, so it cannot be a bare table alias: Postgres
-- rejects this statement at parse time. It has therefore never applied on any
-- database, which stopped every deployment here and left migrations 049-051
-- unapplied. Aliased to `g`; the backfill is unchanged and still idempotent
-- via the `is null` guard below.
update student_claims claim
set warn30_sent_for_grant_id = case when claim.warn30_sent_at is not null then g.id end,
    expired_sent_for_grant_id = case when claim.expired_sent_at is not null then g.id end,
    winback_sent_for_grant_id = case when claim.winback_sent_at is not null then g.id end
from student_grants g
where g.student_email = claim.student_email
  and (claim.warn30_sent_for_grant_id is null
    or claim.expired_sent_for_grant_id is null
    or claim.winback_sent_for_grant_id is null);

do $$ begin
  alter table student_claims
    add constraint student_claims_warn30_grant_fk
    foreign key (warn30_sent_for_grant_id) references student_grants(id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table student_claims
    add constraint student_claims_expired_grant_fk
    foreign key (expired_sent_for_grant_id) references student_grants(id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table student_claims
    add constraint student_claims_winback_grant_fk
    foreign key (winback_sent_for_grant_id) references student_grants(id);
exception when duplicate_object then null;
end $$;

create or replace function validate_student_offer_pin()
returns trigger language plpgsql as $$
declare
  version_row offer_versions%rowtype;
begin
  select * into version_row from offer_versions where id = new.offer_version_id;
  if version_row.id is null
     or version_row.offer_key <> new.offer_key
     or version_row.version_number <> new.offer_version_number
     or version_row.content_digest <> new.offer_content_digest_snapshot
     or version_row.terms_snapshot <> new.offer_terms_snapshot
     or version_row.status not in ('scheduled', 'published', 'superseded') then
    raise exception 'student offer version pin mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists student_verification_tokens_offer_pin_validate on student_verification_tokens;
create trigger student_verification_tokens_offer_pin_validate
before insert on student_verification_tokens
for each row execute function validate_student_offer_pin();

drop trigger if exists student_verification_tokens_offer_pin_immutable on student_verification_tokens;
create trigger student_verification_tokens_offer_pin_immutable
before update on student_verification_tokens
for each row execute function enforce_student_offer_pin_immutability();

drop trigger if exists student_claims_offer_pin_validate on student_claims;
create trigger student_claims_offer_pin_validate
before insert on student_claims
for each row execute function validate_student_offer_pin();

drop trigger if exists student_claims_offer_pin_immutable on student_claims;
create trigger student_claims_offer_pin_immutable
before update on student_claims
for each row execute function enforce_student_offer_pin_immutability();

drop trigger if exists student_grants_offer_pin_validate on student_grants;
create trigger student_grants_offer_pin_validate
before insert on student_grants
for each row execute function validate_student_offer_pin();

drop trigger if exists student_grants_append_only on student_grants;
create trigger student_grants_append_only
before update or delete on student_grants
for each row execute function reject_immutable_workflow_row();
