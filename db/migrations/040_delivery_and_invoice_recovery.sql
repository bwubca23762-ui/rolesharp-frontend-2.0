-- Persist delivery and provider-invoice state so failures after a committed
-- database write remain observable and recoverable.

alter table email_verification_tokens
  add column if not exists delivery_status text,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_error text;

-- Rows created before this migration predate delivery journaling; their tokens
-- were created by the send path, so treat them as historical sent attempts.
update email_verification_tokens set delivery_status='sent'
where delivery_status is null;

alter table email_verification_tokens
  alter column delivery_status set default 'pending',
  alter column delivery_status set not null,
  drop constraint if exists email_verification_tokens_delivery_status_check,
  add constraint email_verification_tokens_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed'));

alter table student_verification_tokens
  add column if not exists delivery_status text,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_error text;

update student_verification_tokens set delivery_status='sent'
where delivery_status is null;

alter table student_verification_tokens
  alter column delivery_status set default 'pending',
  alter column delivery_status set not null,
  drop constraint if exists student_verification_tokens_delivery_status_check,
  add constraint student_verification_tokens_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed'));

alter table crypto_payments
  add column if not exists provider_invoice_id text,
  add column if not exists invoice_url text,
  add column if not exists invoice_attempted_at timestamptz,
  add column if not exists invoice_error text;

create unique index if not exists crypto_pay_provider_invoice_unique
  on crypto_payments(provider_invoice_id)
  where provider_invoice_id is not null;

create index if not exists crypto_pay_invoice_recovery_idx
  on crypto_payments(status, invoice_attempted_at)
  where status in ('invoice_pending', 'invoice_unknown', 'invoice_failed');
