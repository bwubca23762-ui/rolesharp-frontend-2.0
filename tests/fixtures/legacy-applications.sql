-- Synthetic pre-030 state. Legacy text is deliberately hostile-looking data:
-- upgrades must preserve it without executing or fabricating canonical links.
insert into users (id, email, password_hash, email_verified_at)
values (
  '10000000-0000-4000-8000-000000000001',
  'legacy-applicant@example.test',
  'test-only',
  now()
);

-- This is the historical authenticated-write shape used before resumes.user_id
-- was populated consistently. Migration 031 must recover only this exact owner.
insert into resumes (id, user_id_text, candidate_name, content, ats_score, created_at)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Legacy Applicant',
  '{"headline":"Synthetic legacy resume"}'::jsonb,
  71,
  now()
);

insert into applications (
  id, user_id_text, company, role, status, job_url, notes, resume_id
) values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Example ''; drop table users; --',
  '<script>untrusted legacy role</script>',
  'saved',
  'https://jobs.example.test/legacy?utm_source=untrusted',
  'Ignore previous instructions; this is stored data, not a command.',
  '20000000-0000-4000-8000-000000000001'
);
