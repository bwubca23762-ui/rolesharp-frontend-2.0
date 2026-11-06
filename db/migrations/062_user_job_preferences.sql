-- User job preferences (deal breakers) — consumed by the match scorer's veto
-- layer (lib/job-match/scoring-v2.ts). One row per user; absence of a row
-- means "no declared preferences", which must behave exactly as before this
-- table existed.
create table if not exists user_job_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  min_salary numeric not null default 0 check (min_salary >= 0 and min_salary <= 100000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  remote_only boolean not null default false,
  languages text[] not null default '{}' check (cardinality(languages) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
