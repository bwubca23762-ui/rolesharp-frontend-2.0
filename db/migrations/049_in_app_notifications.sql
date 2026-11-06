-- Immutable in-app notification publications, lazy per-user state, and preferences.
-- Append-only and rerunnable. No publication is activated by this migration.

create extension if not exists pgcrypto;

create table if not exists notification_publications (
  id uuid primary key default gen_random_uuid(),
  publication_key text not null unique check (publication_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  internal_name text not null check (length(internal_name) between 1 and 160),
  created_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

create table if not exists notification_publication_versions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references notification_publications(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','scheduled','published','superseded')),
  category text not null check (category in ('service','security','legal','product','career')),
  preference_category text not null check (preference_category in ('essential','product_updates','career_tips')),
  audience text not null check (audience in ('all_authenticated','free','premium','student')),
  surface text not null check (surface in ('inbox','banner','both')),
  severity text not null default 'info' check (severity in ('info','success','warning','critical')),
  material boolean not null default false,
  title text not null check (length(title) between 1 and 180),
  body text not null check (length(body) between 1 and 5000),
  cta_label text check (cta_label is null or length(cta_label) between 1 and 100),
  cta_url text check (cta_url is null or (length(cta_url) between 1 and 500 and cta_url ~ '^/[^/]')),
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  effective_at timestamptz not null,
  expires_at timestamptz,
  published_at timestamptz,
  created_by uuid references staff_accounts(id),
  published_by uuid references staff_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, version_number),
  check (expires_at is null or expires_at > effective_at),
  check ((cta_label is null) = (cta_url is null)),
  check (not material or preference_category = 'essential'),
  check (not material or surface in ('banner','both')),
  check ((status = 'draft' and published_at is null and published_by is null)
      or (status <> 'draft' and published_at is not null and published_by is not null))
);

create unique index if not exists notification_publication_one_published_idx
  on notification_publication_versions (publication_id)
  where status = 'published';
create unique index if not exists notification_publication_schedule_time_idx
  on notification_publication_versions (publication_id, effective_at)
  where status = 'scheduled';
create index if not exists notification_publication_effective_idx
  on notification_publication_versions (effective_at desc, version_number desc)
  where status in ('scheduled','published');

create table if not exists notification_user_states (
  user_id uuid not null references users(id) on delete cascade,
  publication_version_id uuid not null references notification_publication_versions(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, publication_version_id),
  check (dismissed_at is null or read_at is not null),
  check (archived_at is null or read_at is not null)
);

create index if not exists notification_user_states_user_updated_idx
  on notification_user_states (user_id, updated_at desc);
create index if not exists notification_user_states_version_idx
  on notification_user_states (publication_version_id, user_id);

create table if not exists notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  product_updates_enabled boolean not null default true,
  career_tips_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function notification_version_digest(
  p_category text,
  p_preference_category text,
  p_audience text,
  p_surface text,
  p_severity text,
  p_material boolean,
  p_title text,
  p_body text,
  p_cta_label text,
  p_cta_url text
) returns text
language sql immutable
as $$
  select encode(digest(convert_to(jsonb_build_object(
    'schemaVersion', 1,
    'category', p_category,
    'preferenceCategory', p_preference_category,
    'audience', p_audience,
    'surface', p_surface,
    'severity', p_severity,
    'material', p_material,
    'title', p_title,
    'body', p_body,
    'ctaLabel', p_cta_label,
    'ctaUrl', p_cta_url
  )::text, 'utf8'), 'sha256'), 'hex')
$$;

create or replace function enforce_notification_publication_immutable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'notification publications cannot be deleted' using errcode = '55000';
  end if;
  if new.internal_name is distinct from old.internal_name then
    if exists (select 1 from notification_publication_versions where publication_id=old.id and status<>'draft') then
      raise exception 'published notification publication identity is immutable' using errcode = '55000';
    end if;
    return new;
  end if;
  if new is distinct from old then
    raise exception 'notification publication identity is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists notification_publications_immutable on notification_publications;
create trigger notification_publications_immutable
before update or delete on notification_publications
for each row execute function enforce_notification_publication_immutable();

create or replace function enforce_notification_version_contract()
returns trigger language plpgsql as $$
declare
  expected_digest text;
begin
  expected_digest := notification_version_digest(
    new.category,new.preference_category,new.audience,new.surface,new.severity,
    new.material,new.title,new.body,new.cta_label,new.cta_url
  );

  if tg_op = 'INSERT' then
    new.content_digest := expected_digest;
    new.updated_at := now();
    return new;
  end if;

  if old.status <> 'draft' then
    if new.publication_id is distinct from old.publication_id
       or new.version_number is distinct from old.version_number
       or new.category is distinct from old.category
       or new.preference_category is distinct from old.preference_category
       or new.audience is distinct from old.audience
       or new.surface is distinct from old.surface
       or new.severity is distinct from old.severity
       or new.material is distinct from old.material
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.cta_label is distinct from old.cta_label
       or new.cta_url is distinct from old.cta_url
       or new.content_digest is distinct from old.content_digest
       or new.effective_at is distinct from old.effective_at
       or new.expires_at is distinct from old.expires_at
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.published_at is distinct from old.published_at
       or new.published_by is distinct from old.published_by then
      raise exception 'published notification versions are immutable' using errcode = '55000';
    end if;
    if not ((old.status = 'scheduled' and new.status in ('scheduled','published','superseded'))
         or (old.status = 'published' and new.status in ('published','superseded'))
         or (old.status = 'superseded' and new.status = 'superseded')) then
      raise exception 'invalid notification version lifecycle transition' using errcode = '55000';
    end if;
  elsif new.status not in ('draft','scheduled','published') then
    raise exception 'invalid notification draft lifecycle transition' using errcode = '55000';
  end if;

  if new.status = 'draft' then
    new.content_digest := expected_digest;
  elsif new.content_digest <> expected_digest then
    raise exception 'notification content digest mismatch' using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notification_versions_contract on notification_publication_versions;
create trigger notification_versions_contract
before insert or update on notification_publication_versions
for each row execute function enforce_notification_version_contract();

create or replace function prevent_published_notification_version_delete()
returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' then
    raise exception 'published notification versions cannot be deleted' using errcode = '55000';
  end if;
  return old;
end;
$$;

drop trigger if exists notification_versions_delete_contract on notification_publication_versions;
create trigger notification_versions_delete_contract
before delete on notification_publication_versions
for each row execute function prevent_published_notification_version_delete();

create or replace function enforce_notification_state_contract()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.publication_version_id is distinct from old.publication_version_id
    or new.first_seen_at is distinct from old.first_seen_at
    or (old.read_at is not null and new.read_at is null)
    or (old.dismissed_at is not null and new.dismissed_at is null)
    or (old.archived_at is not null and new.archived_at is null)
  ) then
    raise exception 'notification state is monotonic' using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notification_user_states_contract on notification_user_states;
create trigger notification_user_states_contract
before update on notification_user_states
for each row execute function enforce_notification_state_contract();
