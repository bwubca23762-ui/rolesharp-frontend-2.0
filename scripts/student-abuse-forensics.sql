-- Student premium abuse forensics (migration 065 closes enrollment; this is
-- the cleanup playbook for accounts already claimed).
--
-- Run these against the PRODUCTION database by hand, in order, and review the
-- output before any UPDATE. Each step is read-only unless it says otherwise.
-- Use: docker exec -i resume-pg psql -U <user> -d <db> < this file (or paste).

-- ---------- Step 1: claim velocity per domain (read-only) ----------
select
  split_part(student_email, '@', 2) as domain,
  count(*) as total_claims,
  min(claimed_at) as first_claim,
  max(claimed_at) as last_claim
from student_claims
group by split_part(student_email, '@', 2)
having count(*) > 5
order by total_claims desc;

-- ---------- Step 2: same-account sharing signals (read-only) ----------
-- Many students verified from a handful of IPs is the reseller fingerprint.
select ip_hash, count(*) as claims
from (
  select user_id, md5(student_email || 'salt-not-real-ip') as ip_hash from student_claims
) s
group by ip_hash having count(*) > 3
limit 50;
-- NOTE: student_claims does not store IPs historically; combine with reverse
-- proxy access logs for the /api/student/confirm path when investigating.

-- ---------- Step 3: revoke a specific blacklist (MUTATING — review first) ----------
-- Replace the pattern list with the domains Step 1 surfaced. This revokes
-- premium but leaves the accounts themselves intact.
-- update users
-- set premium_until = null,
--     premium_source = null
-- where premium_source = 'student'
--   and student_email ilike any (array[
--     '%.edu.pl%', '%.edu.vn%'
--     -- ... add the domains Step 1 identified
--   ]);
--
-- The owner-facing record of the cleanup:
-- insert into admin_actions (action, target_email, details)
-- values ('bulk_student_revocation', 'system',
--         '{"reason": "black_market_resale_cleanup", "source": "student_audit"}');
