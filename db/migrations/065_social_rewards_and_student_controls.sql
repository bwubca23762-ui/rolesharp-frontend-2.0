-- 065: Social follow rewards + student-offer kill switch.
--
-- Part A — social rewards: users claim a per-platform reward (+N credits)
-- for following @rolesharpai on X, the LinkedIn company page, and Instagram.
-- Verification is intent + handle (no platform API can check follows without
-- enterprise OAuth); the sybil guards are database constraints: one claim per
-- account per platform, and one claim per handle across ALL accounts — so a
-- reseller farming accounts cannot reuse the same social identity.
--
-- Part B — student offer kill switch: the student_offer feature flag is set
-- OFF here (reseller cleanup). lib/social-rewards and lib/student read it at
-- runtime; existing premium grants run out naturally, no new tokens.

create table if not exists social_reward_claims (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  platform text not null check (platform in ('x', 'linkedin', 'instagram')),
  handle text not null,
  credits_awarded int not null default 1,
  ip_address text,
  created_at timestamptz not null default now(),

  -- One claim per account per platform.
  constraint social_reward_claims_user_platform_unique unique (user_id, platform),
  -- One claim per handle across every account (anti-sybil).
  constraint social_reward_claims_platform_handle_unique unique (platform, handle)
);

create index if not exists social_reward_claims_user_idx on social_reward_claims(user_id);
create index if not exists social_reward_claims_created_idx on social_reward_claims(created_at);

-- Admin-settable campaign config (single row).
create table if not exists social_reward_config (
  id boolean primary key default true check (id),
  active boolean not null default true,
  credits_per_platform int not null default 1 check (credits_per_platform between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into social_reward_config (id) values (true) on conflict do nothing;

insert into feature_flags (name, enabled, description)
values ('social_rewards', true, 'Enable Instagram, LinkedIn, and X follow credit rewards')
on conflict (name) do nothing;

-- The student offer flag ships OFF (reseller cleanup): no new student tokens.
-- The env switch STUDENT_OFFER_ENABLED can re-open it without a migration.
insert into feature_flags (name, enabled, description)
values ('student_offer', false, 'Allow student premium claims')
on conflict (name) do update set enabled = false, updated_at = now();
