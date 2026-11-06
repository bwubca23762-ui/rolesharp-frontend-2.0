-- Social rewards completion bonus: claim the follow reward on every platform
-- (each claim still bound by UNIQUE (user_id, platform) and
-- UNIQUE (platform, handle) from migration 065) and the account earns
-- premium_days one time, unlocking daily job-alert mail while it lasts.
alter table social_reward_config
  add column if not exists premium_bonus_days int not null default 15
  check (premium_bonus_days between 0 and 365);

-- Once-per-user ledger for the completion bonus. The primary key IS the
-- once-only lock: INSERT ... ON CONFLICT (user_id) DO NOTHING makes a second
-- grant impossible, and a deleted user cannot leave a dangling row.
create table if not exists social_reward_bonus (
  user_id uuid primary key references users(id) on delete cascade,
  premium_days int not null check (premium_days between 0 and 365),
  claimed_at timestamptz not null default now()
);

create index if not exists social_reward_bonus_claimed_idx on social_reward_bonus(claimed_at);
