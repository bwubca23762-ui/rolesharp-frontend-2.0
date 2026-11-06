-- Enforce the approved per-provider cap at the same atomic reservation boundary
-- that consumes the existing user-local daily quota. A revoked grant therefore
-- stops future provider calls even if a stale worker is still running.

create table if not exists application_provider_daily_counters (
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  local_date date not null,
  count integer not null default 0 check (count >= 0),
  effective_cap_snapshot integer not null check (effective_cap_snapshot between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, local_date),
  check (count <= effective_cap_snapshot)
);

create index if not exists application_provider_daily_counters_date_idx
  on application_provider_daily_counters (provider, local_date desc);

create or replace function enforce_provider_feature_cap()
returns trigger language plpgsql as $$
declare
  provider_name text;
  provider_cap integer;
  current_count integer;
  quota_date date;
begin
  select case when e.provider = 'google' then 'google' else 'microsoft' end
    into provider_name
    from application_mail_attempts a
    join email_connections e on e.id = a.connection_id and e.user_id = a.user_id
    where a.id = new.attempt_id and a.user_id = new.user_id;
  if provider_name is null then
    raise exception 'mail provider is unavailable' using errcode = '23514';
  end if;

  quota_date := new.local_date;
  select least(coalesce(g.provider_limit, 5), 5)
    into provider_cap
    from feature_access_grants g
    where g.user_id = new.user_id
      and g.feature_key = case when provider_name = 'google' then 'role_apply_gmail' else 'role_apply_microsoft' end
      and g.state = 'approved'
      and (g.expires_at is null or g.expires_at > now())
    for share;
  if provider_cap is null then
    raise exception 'provider feature access is not active' using errcode = '23514';
  end if;

  insert into application_provider_daily_counters
    (user_id, provider, local_date, count, effective_cap_snapshot)
  values
    (new.user_id, provider_name, quota_date, 0, provider_cap)
  on conflict (user_id, provider, local_date) do nothing;

  select count, least(effective_cap_snapshot, provider_cap)
    into current_count, provider_cap
    from application_provider_daily_counters
    where user_id = new.user_id and provider = provider_name and local_date = quota_date
    for update;
  if current_count >= provider_cap then
    raise exception 'provider daily cap reached' using errcode = '23514';
  end if;

  update application_provider_daily_counters
    set count = count + 1, effective_cap_snapshot = least(effective_cap_snapshot, provider_cap), updated_at = now()
    where user_id = new.user_id and provider = provider_name and local_date = quota_date
      and count < provider_cap;
  if not found then
    raise exception 'provider daily cap race lost' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists application_quota_provider_cap on application_quota_reservations;
create trigger application_quota_provider_cap
before insert on application_quota_reservations
for each row execute function enforce_provider_feature_cap();
