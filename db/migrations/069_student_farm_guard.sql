-- Student offer farm guard: student verification tokens record the requesting
-- IP so multi-account farming from one machine (rented .edu inboxes included)
-- is detectable and the farm-guard can auto-ban. Additive and idempotent.
alter table student_verification_tokens
  add column if not exists request_ip text;

create index if not exists student_verif_ip_created_idx
  on student_verification_tokens (request_ip, created_at desc)
  where request_ip is not null;
