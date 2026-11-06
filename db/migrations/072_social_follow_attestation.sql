-- Record a user's explicit follow attestation with each social reward claim.
-- Historical claims remain NULL: they were not collected under this attestation.
alter table social_reward_claims
  add column if not exists follow_attested_at timestamptz;

alter table social_reward_claims
  alter column follow_attested_at set default now();

comment on column social_reward_claims.follow_attested_at is
  'Timestamp the claimant explicitly attested they followed the channel; NULL for legacy claims. This is not third-party verification.';

comment on column social_reward_config.premium_bonus_days is
  'Legacy column name. Configures a Daily Matches feature-access trial only; it does not grant general Premium.';

comment on column social_reward_bonus.premium_days is
  'Legacy column name. Records Daily Matches trial days only; it does not grant general Premium.';
