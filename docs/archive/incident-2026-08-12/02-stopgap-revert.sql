\set ON_ERROR_STOP on
-- Reverts .student-flow-stopgap.sql. Run once the new release is serving and
-- the student flow has been verified against it.
begin;

alter table student_verification_tokens
  alter column offer_version_id drop default,
  alter column offer_key drop default,
  alter column offer_version_number drop default,
  alter column offer_content_digest_snapshot drop default,
  alter column offer_terms_snapshot drop default;

alter table student_claims
  alter column offer_version_id drop default,
  alter column offer_key drop default,
  alter column offer_version_number drop default,
  alter column offer_content_digest_snapshot drop default,
  alter column offer_terms_snapshot drop default;

commit;
