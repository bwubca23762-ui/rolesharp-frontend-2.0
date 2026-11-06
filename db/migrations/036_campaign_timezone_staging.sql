-- Stage campaign timezone changes at the next date in the old timezone. This
-- prevents a settings edit from manufacturing a second scheduling day.

alter table job_campaigns add column if not exists pending_timezone text;
alter table job_campaigns add column if not exists pending_timezone_generation integer;
alter table job_campaigns add column if not exists next_timezone_activation_date date;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='job_campaigns_pending_timezone_check') then
    alter table job_campaigns add constraint job_campaigns_pending_timezone_check check (
      (pending_timezone is null and pending_timezone_generation is null and next_timezone_activation_date is null)
      or
      (pending_timezone is not null and pending_timezone_generation=timezone_generation+1
        and next_timezone_activation_date is not null)
    );
  end if;
end $$;
