-- 073_lifecycle_expansion.sql — lifecycle expansion (2026-10-21).
-- Three concerns, all idempotent:
--   1. personal_sites gains case-study portfolio content, traffic signal,
--      talent-marketplace opt-in, a verified ATS score snapshot, and the
--      site's target role (for the campus + talent surfaces).
--   2. applications gains offer-comparison and follow-up lifecycle fields
--      (comp terms, interview notes, thank-you tracking) plus an optional
--      A/B variant label for the tracker funnel dashboard.
--   3. New tables: campus_portals (university placement analytics) and
--      talent_intro_requests (anonymized, opt-in candidate introductions).

-- ── personal_sites ──────────────────────────────────────────────────────
alter table personal_sites add column if not exists case_studies jsonb not null default '[]';
alter table personal_sites add column if not exists view_count int not null default 0;
alter table personal_sites add column if not exists talent_marketplace_opt_in boolean not null default false;
alter table personal_sites add column if not exists verified_ats_score int;
alter table personal_sites add column if not exists target_role_slug text;

-- ── applications ────────────────────────────────────────────────────────
alter table applications add column if not exists resume_variant_label text;
alter table applications add column if not exists comp_bonus_pct numeric(5,2);
alter table applications add column if not exists comp_signing_bonus numeric(12,2);
alter table applications add column if not exists comp_equity_total numeric(14,2);
alter table applications add column if not exists comp_vesting_schedule text;
alter table applications add column if not exists comp_pto_days int;
alter table applications add column if not exists comp_work_mode text;
alter table applications add column if not exists interview_notes text;
alter table applications add column if not exists thank_you_sent_at timestamptz;

-- ── campus portals ──────────────────────────────────────────────────────
create table if not exists campus_portals (
  id bigint generated always as identity primary key,
  slug text not null unique,
  university_name text not null,
  email_domain text not null,
  cohort_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Placement analytics read only aggregated, k-anonymized rows: a cohort with
-- fewer than 5 members reports nothing.
create index if not exists campus_portals_domain_idx on campus_portals (email_domain);

-- ── talent intro requests ───────────────────────────────────────────────
create table if not exists talent_intro_requests (
  id bigint generated always as identity primary key,
  -- personal_sites.id is uuid (052): the FK must match, not assume bigint.
  personal_site_id uuid not null references personal_sites(id) on delete cascade,
  requester_contact text not null,
  requester_company text not null,
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists talent_intro_site_idx on talent_intro_requests (personal_site_id, created_at desc);
