-- Credit system: referrals, Telegram verification, and premium-unlocked resumes.
alter table users add column if not exists credits int not null default 0;
alter table users add column if not exists invite_code text;
alter table users add column if not exists referred_by uuid references users(id);
alter table users add column if not exists telegram_verified_at timestamptz;
alter table users add column if not exists telegram_user_id text;

create unique index if not exists users_invite_code_uniq on users (invite_code) where invite_code is not null;
create index if not exists users_referred_by_idx on users (referred_by) where referred_by is not null;

alter table resumes add column if not exists premium_unlock boolean not null default false;
alter table resumes add column if not exists credit_event_id bigint;

create table if not exists credit_events (
  id bigserial primary key,
  user_id uuid references users(id) on delete cascade,
  kind text not null,
  delta int not null,
  ref_user_id uuid references users(id) on delete set null,
  resume_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_events_user_idx on credit_events (user_id, created_at desc);
create unique index if not exists credit_events_referral_once on credit_events (kind, ref_user_id) where kind='referral_verified';
create unique index if not exists credit_events_telegram_once on credit_events (user_id, kind) where kind='telegram_verified';
