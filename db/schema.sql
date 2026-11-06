-- ============================================================
-- resume-ai schema  (Postgres 15+ / Supabase, pgvector)
-- Designed for 8GB RAM / 100GB disk.
--
-- Storage math (target ~72GB of 100GB usable):
--   Tier A  ~10K  companies @ ~25KB (embedding + cached text) = ~0.25 GB
--   Tier B  ~1.5M companies @ ~8KB  (embedding only)          = ~12 GB
--   Tier C  ~30M  companies @ ~2KB  (lean, NO embedding)      = ~60 GB
--   Roles   ~10K  @ ~10KB (embedding + skills)                = ~0.1 GB
-- RAM cost is the INDEXES (name btree ~2GB + HNSW on A/B ~2GB), not rows.
-- ============================================================

create extension if not exists vector;
create extension if not exists pg_trgm;   -- fast fuzzy company-name search

-- ---------- COUNTRIES (top-10 first, then all 195) ----------
create table countries (
  code        char(2) primary key,          -- ISO-3166 e.g. 'US'
  name        text not null,
  priority    int  not null default 100,     -- 1..10 = launch markets
  -- resume format rules differ by country (photo? DOB? page length)
  rules       jsonb not null default '{}'::jsonb
);

-- ---------- COMPANIES (the 3-tier directory) ----------
-- tier: 'A' deep | 'B' embedded | 'C' lean
create table companies (
  id            bigint generated always as identity primary key,
  slug          text not null unique,         -- 'google', used in /resume/google/...
  name          text not null,
  aliases       text[] not null default '{}', -- "Alphabet", "Google LLC"
  country_code  char(2),   -- ISO code; not FK-enforced (bulk import has codes beyond seeded countries)
  sector        text,
  size_band     text,                          -- '1-50','51-200',...,'10000+'
  ats_system    text,                          -- 'Workday'|'Greenhouse'|...
  tier          char(1) not null default 'C',  -- A | B | C
  -- Tier A/B only. NULL for Tier C (keeps 30M rows lean -> fits disk).
  embedding     vector(1536),
  -- Tier A only: cached careers-page signal for real tailoring.
  style_profile jsonb,                          -- {tone, values[], keyword_density}
  source        text,                           -- 'gleif'|'wikidata'|'manual'
  created_at    timestamptz not null default now()
);

-- Name search: trigram index serves "search any company" autocomplete.
create index companies_name_trgm on companies using gin (name gin_trgm_ops);
create index companies_slug_idx  on companies (slug);
create index companies_country_tier on companies (country_code, tier);

-- Vector index ONLY over Tier A/B (partial index = no RAM cost for 30M Tier C).
create index companies_embed_hnsw on companies
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

-- ---------- ROLES / OCCUPATION NORMS (finite ~10K, slow-changing) ----------
-- Seeded from O*NET + ESCO + India NCO. This is what we tailor against.
create table roles (
  id              bigint generated always as identity primary key,
  slug            text not null unique,        -- 'software-engineer'
  title           text not null,
  seo_title       text check (seo_title is null or char_length(trim(seo_title)) between 2 and 48),
  sector          text not null,
  seniority       text,                         -- 'junior'|'mid'|'senior'|'lead'
  required_skills text[] not null default '{}',
  preferred_skills text[] not null default '{}',
  typical_bullets text[] not null default '{}', -- metric-driven exemplars
  certifications  text[] not null default '{}',
  embedding       vector(1536),                 -- every role embedded
  source          text                          -- 'onet'|'esco'|'nco'
);
create index roles_embed_hnsw on roles using hnsw (embedding vector_cosine_ops);
create index roles_sector_idx on roles (sector);
create index roles_title_trgm on roles using gin (title gin_trgm_ops);

-- ---------- USERS ----------
create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,
  -- structured facts -> prevents LLM hallucination during generation
  profile     jsonb not null default '{}'::jsonb,  -- {experiences[],education[],skills[],projects[]}
  created_at  timestamptz not null default now()
);

-- ---------- GENERATED RESUMES ----------
create table resumes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  company_id  bigint references companies(id),
  role_id     bigint references roles(id),
  jd_text     text,                              -- pasted JD (best signal)
  content     jsonb not null,                    -- structured resume sections
  ats_score   int,                               -- 0..100 keyword match vs JD
  model       text,
  gen_ms      int,                               -- latency we MEASURE per resume
  created_at  timestamptz not null default now()
);
create index resumes_user_idx on resumes (user_id, created_at desc);

-- ---------- helper: nearest roles for a JD/company embedding ----------
create or replace function match_roles(query vector(1536), k int default 5)
returns table (id bigint, slug text, title text, score float)
language sql stable as $$
  select r.id, r.slug, r.title, 1 - (r.embedding <=> query) as score
  from roles r
  order by r.embedding <=> query
  limit k;
$$;

-- Job workflow schema is maintained as ordered, expand-only migrations:
--   030_job_workflow_core.sql
--   031_mail_connections_and_attempts.sql
--   032_digest_outbox_and_constraints.sql
-- db/schema.sql remains the deployable bootstrap; the migrator applies every
-- ordered migration after this file and is intentionally safe to run twice.

-- ---------- 065: social follow rewards + student-offer kill switch ----------
-- (065_social_rewards_and_student_controls.sql)
--
-- Part A — social rewards: users claim a per-platform reward (+N credits)
-- for following @rolesharpai on X, the LinkedIn company page, and Instagram.
-- Verification is intent + handle (no platform API can check follows without
-- enterprise OAuth); the sybil guards are database constraints: one claim per
-- account per platform, and one claim per handle across ALL accounts — so a
-- reseller farming accounts cannot reuse the same social identity.
--
-- Part B — student offer kill switch: the student_offer feature flag is set
-- OFF here (reseller cleanup). lib/social-rewards and lib/student read it at
-- runtime; existing premium grants run out naturally, no new tokens.

create table if not exists social_reward_claims (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  platform text not null check (platform in ('x', 'linkedin', 'instagram')),
  handle text not null,
  credits_awarded int not null default 1,
  ip_address text,
  created_at timestamptz not null default now(),

  -- One claim per account per platform.
  constraint social_reward_claims_user_platform_unique unique (user_id, platform),
  -- One claim per handle across every account (anti-sybil).
  constraint social_reward_claims_platform_handle_unique unique (platform, handle)
);

create index if not exists social_reward_claims_user_idx on social_reward_claims(user_id);
create index if not exists social_reward_claims_created_idx on social_reward_claims(created_at);

-- Admin-settable campaign config (single row).
create table if not exists social_reward_config (
  id boolean primary key default true check (id),
  active boolean not null default true,
  credits_per_platform int not null default 1 check (credits_per_platform between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into social_reward_config (id) values (true) on conflict do nothing;

-- The social_rewards / student_offer feature-flag rows ship via migration 065
-- itself (feature_flags is created by 021, applied after this bootstrap). The
-- env switch STUDENT_OFFER_ENABLED re-opens the program without a migration.

-- ---------- 067: hard auto-ban & anti-farming ----------
-- users.is_banned: sessions die immediately (lib/auth checks it on every
-- request); signup_ip powers signup-velocity auto-bans; banned_identifiers
-- carries the disposable-domain blacklist and auto-banned IPs.
alter table users
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_reason text,
  add column if not exists signup_ip text,
  add column if not exists last_ip text;

create index if not exists users_is_banned_idx on users (is_banned) where is_banned = true;
create index if not exists users_signup_ip_idx on users (signup_ip) where signup_ip is not null;

create table if not exists banned_identifiers (
  id bigserial primary key,
  kind text not null check (kind in ('ip', 'email_domain', 'fingerprint')),
  value text not null unique,
  reason text not null,
  auto_banned boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists banned_identifiers_kind_val on banned_identifiers(kind, value);

insert into banned_identifiers (kind, value, reason) values
  ('email_domain', 'tempmail.com', 'disposable_email_provider'),
  ('email_domain', 'mailinator.com', 'disposable_email_provider'),
  ('email_domain', 'guerrillamail.com', 'disposable_email_provider'),
  ('email_domain', '10minutemail.com', 'disposable_email_provider'),
  ('email_domain', 'yopmail.com', 'disposable_email_provider'),
  ('email_domain', 'trashmail.com', 'disposable_email_provider'),
  ('email_domain', 'sharklasers.com', 'disposable_email_provider'),
  ('email_domain', 'dispostable.com', 'disposable_email_provider'),
  ('email_domain', 'getairmail.com', 'disposable_email_provider'),
  ('email_domain', 'throwawaymail.com', 'disposable_email_provider'),
  ('email_domain', 'burnermail.io', 'disposable_email_provider'),
  ('email_domain', 'mytemp.email', 'disposable_email_provider')
on conflict (value) do nothing;
