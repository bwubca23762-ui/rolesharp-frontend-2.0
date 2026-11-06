-- Crypto payments (NOWPayments). One row per invoice; webhook updates status.
create table if not exists crypto_payments (
  id           text primary key,            -- NOWPayments payment_id / invoice id
  order_id     text not null,               -- our order ref (encodes user)
  user_id_text text not null,
  status       text not null default 'waiting',
  pay_currency text,
  price_amount numeric,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists crypto_pay_user_idx on crypto_payments (user_id_text, created_at desc);
create index if not exists crypto_pay_order_idx on crypto_payments (order_id);
