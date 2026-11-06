-- Moderated community reports about potentially unsafe internship listings.
-- Reporter identity and evidence are staff-only; public queries return only
-- approved report text and aggregate community activity.
create table if not exists internship_reports (
  id                  uuid primary key default gen_random_uuid(),
  reporter_user_id    uuid not null references users(id) on delete cascade,
  company             text not null check (char_length(company) between 2 and 160),
  location            text not null check (char_length(location) between 2 and 160),
  platform            text check (platform is null or char_length(platform) <= 120),
  risk                text not null check (risk in ('high', 'suspicious', 'unconfirmed')),
  categories          text[] not null check (cardinality(categories) between 1 and 5),
  description         text not null check (char_length(description) between 40 and 4000),
  source_url          text check (source_url is null or char_length(source_url) <= 2048),
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderation_note     text check (moderation_note is null or char_length(moderation_note) <= 1000),
  reviewed_by         text,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists internship_reports_public_idx on internship_reports (status, created_at desc);
create index if not exists internship_reports_reporter_idx on internship_reports (reporter_user_id, created_at desc);
create index if not exists internship_reports_company_idx on internship_reports using gin (company gin_trgm_ops);

create table if not exists internship_report_evidence (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references internship_reports(id) on delete cascade,
  file_name     text not null check (char_length(file_name) between 1 and 180),
  content_type  text not null check (content_type in ('image/png', 'image/jpeg', 'application/pdf')),
  size_bytes    integer not null check (size_bytes between 1 and 1048576),
  data          bytea not null,
  created_at    timestamptz not null default now()
);
create index if not exists internship_report_evidence_report_idx on internship_report_evidence (report_id);

create table if not exists internship_report_votes (
  report_id   uuid not null references internship_reports(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  vote        smallint not null check (vote in (-1, 1)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (report_id, user_id)
);

create table if not exists internship_report_comments (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references internship_reports(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  body        text not null check (char_length(body) between 2 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists internship_report_comments_report_idx on internship_report_comments (report_id, created_at);
