\set ON_ERROR_STOP on
begin;

-- Mirrors lib/student.ts:93 in the CURRENTLY SERVING release (no offer pin columns).
insert into student_verification_tokens
  (user_id, student_email, token_hash, expires_at, delivery_status)
values
  ((select user_id from student_verification_tokens order by id limit 1),
   'verify-probe@example.edu',
   repeat('a', 64),
   now() + interval '48 hours',
   'pending');
\echo VERIFY-1-token-insert-OK

-- Mirrors lib/student.ts:178 in the currently serving release.
insert into student_claims (student_email, user_id)
values ('verify-probe@example.edu', (select user_id from student_claims where user_id is not null limit 1))
on conflict do nothing;
\echo VERIFY-2-claim-insert-OK

-- Mirrors scripts/student-cron.ts:24 (the daily 09:10 cron) and the public
-- unsubscribe route.
update student_claims set warn30_sent_at = now()
 where student_email = (select student_email from student_claims order by student_email limit 1);
\echo VERIFY-3-cron-update-OK

update student_claims set winback_opt_out = true
 where student_email = (select student_email from student_claims order by student_email limit 1);
\echo VERIFY-4-unsubscribe-update-OK

rollback;
\echo ROLLED-BACK
