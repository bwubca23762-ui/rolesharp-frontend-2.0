alter table feature_flags add column if not exists rollout_percent integer not null default 100
  check (rollout_percent between 0 and 100);

create or replace function workflow_rollout_allows(flag_name text, subject_user_id uuid)
returns boolean language sql stable as $$
  select coalesce((select enabled and subject_user_id is not null and
    (('x'||substr(md5(flag_name||':'||subject_user_id::text),1,8))::bit(32)::bigint % 10000) < rollout_percent*100
    from feature_flags where name=flag_name),false)
$$;

-- Existing awards stay approved; only newly submitted claims enter review.
alter table social_reward_config add column if not exists review_required boolean not null default true;
alter table social_reward_claims add column if not exists review_status text not null default 'approved'
  check (review_status in ('pending','approved','rejected'));
alter table social_reward_claims add column if not exists requested_credits integer;
update social_reward_claims set requested_credits=credits_awarded where requested_credits is null;
alter table social_reward_claims alter column requested_credits set default 0;
alter table social_reward_claims alter column requested_credits set not null;
alter table social_reward_claims add column if not exists reviewed_by uuid references staff_accounts(id) on delete set null;
alter table social_reward_claims add column if not exists reviewed_at timestamptz;
alter table social_reward_claims add column if not exists review_note text;
create index if not exists social_reward_review_idx on social_reward_claims(review_status,created_at,id);
create unique index if not exists credit_events_social_claim_once on credit_events((details->>'claimId'))
  where kind='social_reward' and details ? 'claimId';
