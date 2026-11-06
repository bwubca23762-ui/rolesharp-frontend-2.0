-- 076: allow re-targeting a campaign's profile version once matches exist.
--
-- The old composite FK (campaign_id, user_id, profile_version_id) →
-- job_campaigns(id, user_id, profile_version_id) meant that the moment a
-- campaign had ANY matches, PATCHing profileVersionId violated the constraint:
-- old matches still referenced the (campaign, old_version) pair. Users with
-- match history could never update their targeting.
--
-- Match provenance is already preserved by
-- job_matches.profile_version_id → career_profile_versions(id, user_id)
-- (immutable version rows), so the composite edge is redundant. Replace it
-- with a (campaign_id, user_id) edge that survives legitimate re-targeting.
--
-- Idempotent: the migration runner replays every file to prove no-op reruns,
-- so both drops use IF EXISTS and the add is guarded.

alter table job_matches
  drop constraint if exists job_matches_campaign_user_fkey;

alter table job_matches
  drop constraint if exists job_matches_campaign_id_user_id_profile_version_id_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'job_matches_campaign_user_fkey'
      and conrelid = 'job_matches'::regclass
  ) then
    alter table job_matches
      add constraint job_matches_campaign_user_fkey
      foreign key (campaign_id, user_id)
      references job_campaigns(id, user_id)
      on delete cascade;
  end if;
end $$;
