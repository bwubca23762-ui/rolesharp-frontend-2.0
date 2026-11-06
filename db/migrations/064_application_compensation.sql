-- Compensation fields on applications (gap report Tier B; GROWTH-PLAN
-- Evidence Study): target range, offered base, currency, and an equity
-- note. Offered amounts feed outcome analysis (offers by fit score) —
-- this data is only useful because the tracker collects it at the moment
-- the user has it. Whole currency units, not cents.
alter table applications
  add column if not exists comp_target_min int,
  add column if not exists comp_target_max int,
  add column if not exists comp_offered_base int,
  add column if not exists comp_currency char(3),
  add column if not exists comp_equity_note text;

-- One-time onboarding bonus (gap report Tier B): the dashboard checklist
-- pays +1 credit when the account completes the core loop. The partial
-- unique index makes the grant idempotent across redemptions and retries.
create unique index if not exists credit_events_onboarding_once
  on credit_events (user_id) where kind = 'onboarding_checklist';
