create table if not exists feature_flags (
  name        text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);
-- Insert defaults
insert into feature_flags (name, enabled, description) values
  ('maintenance_mode', false, 'Show maintenance page to all non-admin users'),
  ('signups_open', true, 'Allow new user registrations'),
  ('google_oauth', true, 'Show Google sign-in button'),
  ('telegram_rewards', true, 'Allow Telegram credit rewards'),
  ('student_offer', true, 'Allow student premium claims')
on conflict (name) do nothing;
