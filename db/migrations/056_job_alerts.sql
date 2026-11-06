-- Job Alert Emails (T5) - lightweight retention feature
-- Free: 1 weekly alert · Premium: daily alerts (up to 3 slots)

create table if not exists job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role_keyword text not null check (length(role_keyword) between 2 and 60),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  frequency text not null default 'weekly' check (frequency in ('weekly', 'daily')),
  paused boolean not null default false,
  last_sent_at timestamptz,
  unsubscribe_token text not null default gen_random_uuid()::text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_alerts_user_idx on job_alerts (user_id);
create index if not exists job_alerts_due_idx on job_alerts (frequency, paused, last_sent_at)
  where not paused;

-- Enforce tier limits in the database:
-- free users max 1 alert, premium users max 3.
create or replace function enforce_alert_tier_limit()
returns trigger as $$
declare
  user_is_premium boolean;
  existing_count int;
begin
  select premium_until > now() into user_is_premium from users where id = new.user_id;
  select count(*) into existing_count from job_alerts where user_id = new.user_id;
  if user_is_premium then
    if existing_count >= 3 then
      raise exception 'alert_limit_premium' using errcode='P0001';
    end if;
  else
    if existing_count >= 1 then
      raise exception 'alert_limit_free' using errcode='P0001';
    end if;
    -- Free users get weekly only
    new.frequency := 'weekly';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists job_alerts_tier_check on job_alerts;
create trigger job_alerts_tier_check
  before insert on job_alerts
  for each row execute function enforce_alert_tier_limit();
