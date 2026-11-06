-- A social reward is a system-issued, bounded Daily Matches grant. Keep the
-- grant in the existing auditable access ledger while permitting its system
-- actor to have no staff identity.
do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  where c.conrelid = 'feature_access_grants'::regclass
    and c.contype = 'c'
    and lower(pg_get_constraintdef(c.oid)) like '%approved_by is not null%'
    and lower(pg_get_constraintdef(c.oid)) like '%state = ''approved''%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table feature_access_grants drop constraint %I', constraint_name);
  end if;
end $$;

alter table feature_access_grants
  drop constraint if exists feature_access_grants_approval_actor_check;

alter table feature_access_grants
  add constraint feature_access_grants_approval_actor_check check (
    (state = 'requested' and approved_at is null and approved_by is null and suspended_at is null and revoked_at is null)
    or (state = 'approved' and approved_at is not null
      and (approved_by is not null or reason = 'social_reward_trial')
      and suspended_at is null and revoked_at is null)
    or (state = 'suspended' and approved_at is not null
      and (approved_by is not null or reason like 'social_reward_trial%')
      and suspended_at is not null and revoked_at is null)
    or (state = 'revoked' and revoked_at is not null)
    or (state = 'expired' and approved_at is not null and approved_by is not null and expires_at is not null)
  );

-- Restore access for recent users whose completion bonus was recorded before
-- Daily Matches was connected to this reward. Respect staff suspensions and
-- revocations; requested or expired rows can be replaced by the active trial.
with eligible as (
  select b.user_id,b.claimed_at,b.premium_days,g.state as previous_state
  from social_reward_bonus b
  left join feature_access_grants g
    on g.user_id=b.user_id and g.feature_key='daily_matches'
  where b.claimed_at + make_interval(days => b.premium_days) > now()
    and (g.id is null or g.state in ('requested','expired'))
), granted as (
  insert into feature_access_grants
    (user_id,feature_key,state,daily_cap,reason,approved_at,approved_by,expires_at)
  select user_id,'daily_matches','approved',5,'social_reward_trial',claimed_at,null,
    claimed_at + make_interval(days => premium_days)
  from eligible
  on conflict (user_id,feature_key) do update set
    state='approved',daily_cap=5,provider_limit=null,reason='social_reward_trial',
    risk_notes=null,approved_at=excluded.approved_at,approved_by=null,
    expires_at=excluded.expires_at,suspended_at=null,revoked_at=null,updated_at=now()
  where feature_access_grants.state in ('requested','expired')
  returning id,user_id,feature_key,state,daily_cap,provider_limit,expires_at
)
insert into feature_access_events
  (grant_id,user_id,feature_key,previous_state,new_state,actor_kind,actor_staff_id,reason,grant_snapshot)
select g.id,g.user_id,'daily_matches',e.previous_state,'approved','system',null,
  'social_reward_trial',to_jsonb(g)
from granted g
join eligible e on e.user_id=g.user_id;
