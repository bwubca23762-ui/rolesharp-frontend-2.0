-- 066: Job location preferences — in-country / out-of-country scope plus
-- compatible target countries. Consumed by /api/jobs/suggest (post-resume
-- job suggestions) and the match workflow's country filtering.
alter table user_job_preferences
  add column if not exists location_scope text not null default 'both'
    check (location_scope in ('in_country', 'out_of_country', 'both')),
  add column if not exists home_country text
    check (home_country is null or home_country ~ '^[A-Z]{2}$'),
  add column if not exists target_countries text[] not null default '{}'
    check (cardinality(target_countries) <= 20);
