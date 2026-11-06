-- 075: student_grants is a historical ledger, not a live-state table.
--
-- Release (admin panel or winback flow) deletes the student_claims row so the
-- academic email can claim the offer again. Re-activation then INSERTs a new
-- student_grants row — which crashed with 23505 because this table carried
-- UNIQUE (student_email) / UNIQUE (student_email_fingerprint) from its
-- original single-grant design.
--
-- Uniqueness of the ACTIVE claim is already enforced by
-- student_claims.student_email PRIMARY KEY; the append-only trigger
-- (student_grants_append_only) still blocks UPDATE/DELETE on the ledger.
-- Dropping these constraints lets a released student re-claim while keeping
-- every historical grant row.

alter table student_grants drop constraint if exists student_grants_student_email_key;
alter table student_grants drop constraint if exists student_grants_student_email_fingerprint_key;

-- The fastest lookup on the ledger stays indexed; uniqueness is not required.
create index if not exists student_grants_email_idx on student_grants (student_email);
