-- Durable retry timing for the only safe retry classes (explicit 408/429).
-- A queue delay is never authoritative; workers must re-check this timestamp.

alter table application_mail_attempts
  add column if not exists retry_not_before timestamptz;

create index if not exists application_mail_attempts_retry_due_idx
  on application_mail_attempts(retry_not_before,id)
  where status='retryable';

create or replace function enforce_application_retry_due_boundary()
returns trigger language plpgsql as $$
begin
  if old.status='reserved' and new.status='sending'
    and old.retry_not_before is not null and old.retry_not_before>now() then
    raise exception 'application retry is not due' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists application_retry_due_boundary on application_mail_attempts;
create trigger application_retry_due_boundary
before update of status on application_mail_attempts
for each row execute function enforce_application_retry_due_boundary();
