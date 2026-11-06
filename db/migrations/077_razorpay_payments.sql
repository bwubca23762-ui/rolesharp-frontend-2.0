-- Razorpay Standard Checkout receipts. Kept separate from NOWPayments so
-- provider-specific identifiers and reconciliation never share a lifecycle.
create table if not exists razorpay_payments (
  id                     bigserial primary key,
  razorpay_order_id      text not null unique,
  razorpay_payment_id    text unique,
  receipt                text not null unique,
  user_id_text           text not null,
  plan                   text not null check (plan in ('monthly', 'yearly')),
  days                   integer not null check (days > 0),
  amount_paise           bigint not null check (amount_paise >= 100),
  currency               char(3) not null,
  status                 text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded')),
  signature_verified_at  timestamptz,
  premium_granted_at     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists razorpay_payments_user_created_idx
  on razorpay_payments (user_id_text, created_at desc);
