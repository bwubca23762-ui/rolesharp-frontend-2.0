-- Promo codes / vouchers (TOOLS-TRACKER P1)
-- Percentage or fixed-amount discounts on Premium passes, with per-code
-- redemption caps, expiry, and one-redemption-per-user semantics.

create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  -- `unique`, not a second `primary key`: Postgres allows exactly one per table
  -- and rejected this one outright. `unique` is also all the FK below needs, and
  -- lib/promo-codes.ts only ever looks a row up by `code`, never by `id`.
  code text not null unique check (code ~ '^[A-Z0-9]{4,24}$'),
  -- percentage_off (1-100) XOR amount_off_cents (>0): exactly one is non-null
  percentage_off int check (percentage_off is null or (percentage_off between 1 and 100)),
  amount_off_cents int check (amount_off_cents is null or amount_off_cents > 0),
  check ((percentage_off is not null)::int + (amount_off_cents is not null)::int = 1),
  -- which plans the code applies to; empty = all plans
  applies_to text[] not null default '{}',
  max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  times_redeemed int not null default 0,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create table if not exists promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references promo_codes(code),
  user_id uuid not null references users(id) on delete cascade,
  order_id uuid,
  -- the discount that was actually applied, for accounting
  discount_cents int not null,
  created_at timestamptz not null default now(),
  unique (code, user_id)  -- one redemption of a given code per user, ever
);

create index if not exists promo_redemptions_user_idx on promo_redemptions (user_id);
