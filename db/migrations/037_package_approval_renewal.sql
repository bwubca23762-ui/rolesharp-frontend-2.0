-- Permit a fresh immutable approval receipt when a review-each approval expires
-- before any provider invocation. Only one receipt may be active at a time.

alter table package_approvals
  drop constraint if exists package_approvals_package_id_package_hash_key;

create unique index if not exists package_approvals_one_active_receipt
  on package_approvals(package_id, package_hash)
  where status='active';

create or replace function enforce_workflow_transition()
returns trigger language plpgsql as $$
declare
  legal boolean := false;
begin
  if old.status = new.status then
    return new;
  end if;

  if tg_table_name = 'job_campaigns' then
    legal := (old.status = 'draft' and new.status in ('active', 'canceled'))
      or (old.status = 'active' and new.status in ('paused', 'needs_user', 'expired', 'canceled'))
      or (old.status = 'paused' and new.status in ('active', 'needs_user', 'expired', 'canceled'))
      or (old.status = 'needs_user' and new.status in ('active', 'paused', 'expired', 'canceled'));
  elsif tg_table_name = 'oauth_transactions' then
    legal := old.status = 'pending' and new.status in ('consumed', 'expired');
  elsif tg_table_name = 'email_connections' then
    legal := (old.status = 'active' and new.status in ('needs_user', 'disabled'))
      or (old.status = 'needs_user' and new.status in ('active', 'disabled'));
  elsif tg_table_name = 'application_packages' then
    legal := (old.status = 'preparing'
        and new.status in ('review_required', 'ready', 'blocked', 'stale'))
      or (old.status = 'review_required' and new.status in ('ready', 'blocked', 'stale'))
      or (old.status = 'ready' and new.status in ('blocked', 'stale'));
  elsif tg_table_name = 'package_approvals' then
    legal := old.status = 'active' and new.status in ('invalidated', 'expired', 'consumed');
  elsif tg_table_name = 'application_mail_attempts' then
    legal := (old.status = 'queued' and new.status in ('blocked', 'canceled', 'reserved', 'needs_user'))
      or (old.status = 'reserved' and new.status in ('blocked', 'canceled', 'sending'))
      or (old.status = 'sending' and new.status in (
        'provider_accepted', 'unknown', 'needs_user', 'retryable', 'terminal_failed'
      ))
      or (old.status = 'retryable' and new.status in (
        'reserved', 'terminal_failed', 'blocked', 'canceled'
      ))
      or (old.status = 'needs_user' and new.status in ('queued', 'canceled'));
  elsif tg_table_name = 'digest_runs' then
    legal := (old.status = 'prepared' and new.status = 'queued')
      or (old.status = 'queued' and new.status in (
        'provider_accepted', 'failed', 'unknown', 'needs_user'
      ));
  elsif tg_table_name = 'notification_outbox' then
    legal := (old.status = 'pending' and new.status in ('claimed', 'canceled'))
      or (old.status = 'claimed' and new.status in ('sending', 'canceled'))
      or (old.status = 'sending' and new.status in (
        'provider_accepted', 'failed', 'unknown', 'needs_user'
      ));
  end if;

  if not legal then
    raise exception 'illegal % status transition: % -> %', tg_table_name, old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;
