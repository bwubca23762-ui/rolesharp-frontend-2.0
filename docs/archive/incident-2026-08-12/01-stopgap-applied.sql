\set ON_ERROR_STOP on
-- TEMPORARY STOPGAP -- remove immediately after the new release is serving.
--
-- Migration 048 made the five offer-pin columns NOT NULL on
-- student_verification_tokens and student_claims. The release currently serving
-- (20260804094521-813, Aug 4) predates those columns and inserts without them,
-- so every student verification and every claim fails right now.
--
-- Defaulting the pins to the published student_premium v1 row restores the flow
-- and still satisfies the NOT NULL, both composite FKs and the digest CHECK.
-- The code in main supplies these columns explicitly, so the defaults are dead
-- weight the moment the new release is live -- and a hazard if left behind,
-- because they would let future code silently pin to v1. Drop them after cutover
-- with .student-flow-stopgap-revert.sql.
begin;

do $$
declare
  v offer_versions%rowtype;
  t text;
begin
  select * into strict v
  from offer_versions
  where offer_key = 'student_premium' and version_number = 1 and status = 'published';

  foreach t in array array['student_verification_tokens', 'student_claims'] loop
    execute format(
      'alter table %I
         alter column offer_version_id set default %L,
         alter column offer_key set default %L,
         alter column offer_version_number set default %L,
         alter column offer_content_digest_snapshot set default %L,
         alter column offer_terms_snapshot set default %L',
      t, v.id, v.offer_key, v.version_number, v.content_digest, v.terms_snapshot);
  end loop;
end $$;

commit;
