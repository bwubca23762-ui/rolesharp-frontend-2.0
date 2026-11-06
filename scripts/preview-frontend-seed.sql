begin;

insert into users (id, email, password_hash, email_verified_at, created_at)
values ('00000000-0000-4000-8000-000000000001', :'demo_email', :'demo_hash', now(), '2024-01-01')
returning id as user_id \gset

insert into countries (code, name, priority) values ('US', 'United States', 1);
insert into companies (slug, name, country_code, sector, tier) values
  ('harbor-labs', 'Harbor Labs', 'US', 'Software', 'A'),
  ('northwind-studio', 'Northwind Studio', 'US', 'Software', 'A');
insert into roles (slug, title, sector, required_skills, preferred_skills)
values (
  'product-manager',
  'Product Manager',
  'Technology',
  array['Roadmapping', 'SQL', 'User research', 'Experiment design', 'Product analytics'],
  array['Product strategy', 'A/B testing', 'Stakeholder management']
)
returning id as role_id \gset

insert into roles (slug, title, sector, required_skills, preferred_skills, typical_bullets)
values (
  'software-engineer',
  'Software Engineer',
  'Technology',
  array['TypeScript', 'System design', 'Code review', 'Testing'],
  array['React', 'PostgreSQL'],
  array['Improved a production workflow with a measured reliability outcome.']
);

insert into resumes (id, user_id, user_id_text, company_id, role_id, candidate_name, content, ats_score, template, premium_unlock, jd_text)
select v.id::uuid, :'user_id', :'user_id', c.id, :'role_id', 'Avery Chen',
  jsonb_build_object(
    'headline', 'Product Manager',
    'contact', jsonb_build_object('email', :'demo_email', 'location', 'Brooklyn, NY'),
    'summary', 'Product manager with six years of experience improving onboarding and retention for B2B software.',
    'skills', jsonb_build_array('Roadmapping', 'SQL', 'User research', 'Experiment design', 'Product analytics'),
    'experiences', '[{"title":"Product Manager","company":"Fieldnote Software","period":"2021–Present","bullets":["Led an onboarding redesign that raised trial activation from 42% to 53% over two quarters.","Partnered with engineering and support to reduce time to first setup from three days to one."]},{"title":"Associate Product Manager","company":"Juniper Metrics","period":"2019–2021","bullets":["Built a weekly retention report that helped three teams prioritize fixes for new accounts."]}]'::jsonb,
    'education', '[{"degree":"B.S. in Information Science","school":"Cedar State University","year":"2019"}]'::jsonb
  ), v.score, 'basic', true, 'Lead onboarding experiments and measure activation for a B2B product.'
from (values
  ('00000000-0000-4000-8000-000000000011', 'harbor-labs', 86),
  ('00000000-0000-4000-8000-000000000012', 'northwind-studio', 78)
) v(id, slug, score) join companies c on c.slug = v.slug;

insert into personal_sites (user_id, handle, resume_id, display_name, show_contact, indexable, portfolio, case_studies, published_at, verified_ats_score, target_role_slug, talent_marketplace_opt_in)
values (
  :'user_id',
  'avery-chen',
  '00000000-0000-4000-8000-000000000011',
  'Avery Chen',
  false,
  false,
  '[{"title":"Onboarding case study","url":"https://example.com/avery-onboarding","description":"A fictional local-preview portfolio link."}]'::jsonb,
  '[]'::jsonb,
  now(),
  86,
  'product-manager',
  true
);

insert into support_tickets (user_id_text, email, name, subject, status, last_actor)
values (:'user_id', :'demo_email', 'Avery Chen', 'Question about tailoring a resume', 'answered', 'admin')
returning id as support_ticket_id \gset

insert into support_messages (ticket_id, author, body)
values
  (:'support_ticket_id', 'user', 'I have a fictional local-preview question about a tailored resume.'),
  (:'support_ticket_id', 'admin', 'This sample conversation exists only so the frontend review can show a populated ticket.');

insert into campus_portals (slug, university_name, email_domain, cohort_secret)
values ('cedar-state', 'Cedar State University', 'cedar.example', 'local-preview-only');

insert into applications (user_id_text, company, role, status, job_url, notes, resume_id, resume_variant_label, follow_up_at, created_at, updated_at) values
  (:'user_id', 'Harbor Labs', 'Product Manager', 'applied', 'https://harbor-labs.example/jobs/product-manager', 'Sent the onboarding version. Follow up with recruiting.', '00000000-0000-4000-8000-000000000011', 'Onboarding', now() + interval '2 days', now() - interval '14 days', now() - interval '12 days'),
  (:'user_id', 'Northwind Studio', 'Growth Product Manager', 'interview', 'https://northwind.example/jobs/growth-product-manager', 'Prepare an example of a retention experiment for the panel.', '00000000-0000-4000-8000-000000000012', 'Growth', now() + interval '4 days', now() - interval '8 days', now() - interval '1 day'),
  (:'user_id', 'Atlas Relay', 'Product Lead', 'saved', 'https://atlas-relay.example/jobs/product-lead', 'Review the role before tailoring.', null, null, null, now() - interval '3 days', now() - interval '3 days'),
  (:'user_id', 'Cedar Lane', 'Platform Product Manager', 'offer', 'https://cedar-lane.example/jobs/platform-pm', 'Review the written offer this week.', null, null, now() + interval '5 days', now() - interval '26 days', now() - interval '2 days'),
  (:'user_id', 'Juniper Systems', 'Product Manager', 'rejected', null, 'Role closed after the first round.', null, null, null, now() - interval '28 days', now() - interval '5 days');

insert into career_profile_versions (user_id, version, normalized_facts, provenance, facts_hash)
values (:'user_id', 1, '{"desiredTitles":[{"text":"Product Manager"},{"text":"Growth Product Manager"}],"skills":[{"text":"SQL"},{"text":"Roadmapping"},{"text":"User research"}],"relevantExperience":{"months":72},"seniority":{"level":"senior","track":"individual"},"locationPreferences":[{"location":"New York, NY"}],"remotePolicies":["remote","hybrid"],"workTypes":[{"type":"full_time"}]}', '{}', repeat('a', 64))
returning id as profile_id \gset

insert into job_campaigns (user_id, mode, authorization_mode, status, profile_version_id, profile_version, criteria_version, criteria, timezone, timezone_generation, daily_time, daily_limit, fit_score_floor, confidence_score_floor)
values (:'user_id', 'daily_matches', 'review_each', 'active', :'profile_id', 1, 1, '{"countries":["US"],"preferredSkills":["Experiment design"]}', 'America/New_York', 1, '08:30', 5, 70, 65)
returning id as campaign_id \gset

insert into jobs (provider, external_id, title, company, country_code, location, city, is_remote, job_type, description, apply_url, source_url, date_posted)
values
  ('review', 'lantern-pm', 'Senior Product Manager, Activation', 'Lantern Works', 'US', 'New York, NY', 'New York', true, 'full_time', 'Own first-run activation and onboarding experiments for a small B2B product team.', 'https://lantern-works.example/jobs/activation', 'https://lantern-works.example/jobs/activation', now()),
  ('review', 'atlas-platform', 'Platform Product Manager', 'Atlas Relay', 'US', 'Boston, MA', 'Boston', true, 'full_time', 'Work with engineering on partner integrations and platform adoption.', 'https://atlas-relay.example/jobs/platform', 'https://atlas-relay.example/jobs/platform', now());

insert into jobs (provider, external_id, title, company, country_code, location, city, is_remote, job_type, description, apply_url, source_url, salary_min, salary_max, salary_currency, salary_interval, date_posted)
select
  'review',
  'salary-product-manager-' || series,
  'Product Manager',
  'Fictional Market Company ' || series,
  'US',
  'New York, NY',
  'New York',
  true,
  'full_time',
  'Fictional salary sample for the local frontend review.',
  'https://fictional-market.example/jobs/' || series,
  'https://fictional-market.example/jobs/' || series,
  112000 + series * 1000,
  132000 + series * 1000,
  'USD',
  'yearly',
  now() - make_interval(days => series)
from generate_series(1, 8) as series;

insert into canonical_companies (canonical_company_key, verified_domain, identity_confidence, identity_state)
values ('domain:lantern-works.example', 'lantern-works.example', 10000, 'verified');
insert into canonical_jobs (canonical_job_key, canonical_company_key, key_kind)
values ('provider:review:lantern-pm', 'domain:lantern-works.example', 'provider_fallback');
insert into canonical_job_aliases (provider_namespace, provider_job_id, canonical_job_key)
values ('review', 'lantern-pm', 'provider:review:lantern-pm');
insert into job_snapshots (canonical_job_key, canonical_company_key, provider_namespace, provider_job_id, source_url, source_body, source_body_hash, captured_at, published_at, expires_at, facts)
values ('provider:review:lantern-pm', 'domain:lantern-works.example', 'review', 'lantern-pm', 'https://lantern-works.example/jobs/activation', 'Fictional posting: Own activation and email your resume to hiring@lantern-works.example.', repeat('b', 64), now(), now(), now() + interval '7 days', '{}')
returning id as snapshot_id \gset

insert into job_matches (user_id, campaign_id, profile_version_id, job_snapshot_id, canonical_job_key, canonical_company_key, score_version, fit_score, confidence_score, fit_numerator, confidence_numerator, breakdown, provenance, blockers, status, ranked_at)
values (:'user_id', :'campaign_id', :'profile_id', :'snapshot_id', 'provider:review:lantern-pm', 'domain:lantern-works.example', 1, 86, 93, 86, 93,
  '{"signals":[{"signal":"Onboarding","fitDisplayPoints":24,"confidenceDisplayPoints":25,"explanation":"The resume describes a measured improvement to trial activation."}]}',
  '{}', '[]', 'eligible', now());

insert into email_connections (user_id, provider, provider_tenant, provider_subject, verified_sender, granted_scopes, connection_generation, status, disabled_at)
values (:'user_id', 'google', 'google', 'fictional-preview-mailbox', :'demo_email', array['openid','email','https://www.googleapis.com/auth/gmail.send'], 1, 'disabled', now())
returning id as connection_id \gset

insert into application_packages (user_id, canonical_job_key, canonical_company_key, job_snapshot_id, profile_version_id, resume_id, template_version, policy_version, score_version, extraction_version, connection_id, connection_generation, recipient_record, subject, body, attachment_hash, attachment_bytes_hash, package_hash, status)
values (:'user_id', 'provider:review:lantern-pm', 'domain:lantern-works.example', :'snapshot_id', :'profile_id', '00000000-0000-4000-8000-000000000011',
  1, 1, 1, 1, :'connection_id', 1,
  '{"email":"hiring@lantern-works.example","source":"Fictional job posting","canonicalSourceUrl":"https://lantern-works.example/jobs/activation","disposition":"eligible","candidates":[{"email":"hiring@lantern-works.example","instruction":"Attach a PDF resume."}]}',
  'Senior Product Manager, Activation — Avery Chen',
  E'Hi Lantern Works team,\n\nI am applying for the Senior Product Manager role. At Fieldnote Software, I led an onboarding redesign that raised trial activation from 42% to 53%. My resume is attached for review.\n\nAvery Chen',
  repeat('c', 64), repeat('d', 64), repeat('e', 64), 'review_required');

commit;
