-- Finish deferred schema validation after migration 030 normalized applications.
-- VALIDATE CONSTRAINT checks existing rows while allowing ordinary reads/writes;
-- the foreign key already applies to new writes because it was created NOT VALID.
do $$ begin
  if exists (
    select 1 from pg_constraint
    where conname = 'applications_job_id_fk' and not convalidated
  ) then
    alter table applications validate constraint applications_job_id_fk;
  end if;
end $$;

-- Migration 032 validated the active campaign timezone but migration 036 later
-- introduced pending_timezone. Keep both current and staged values inside the
-- PostgreSQL IANA timezone catalogue, including writes outside the HTTP API.
create or replace function enforce_campaign_timezone()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid IANA campaign timezone' using errcode = '23514';
  end if;
  if new.pending_timezone is not null
    and not exists (
      select 1 from pg_timezone_names where name = new.pending_timezone
    ) then
    raise exception 'invalid pending IANA campaign timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists job_campaigns_timezone on job_campaigns;
create trigger job_campaigns_timezone
before insert or update of timezone, pending_timezone on job_campaigns
for each row execute function enforce_campaign_timezone();
