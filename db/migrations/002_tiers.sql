-- Free vs Premium tiers.
-- Free  = capped number of resumes/week, basic template, watermark.
-- Premium = active subscription pass: weekly cap, all templates,
--           cover letter, DOCX, no watermark.

create table if not exists devices (
  device_id     text primary key,          -- client-generated UUID (localStorage)
  premium_until timestamptz,                -- null/past = free
  created_at    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);

-- track which device made each resume + template + cover letter
alter table resumes add column if not exists device_id text;
alter table resumes add column if not exists template  text not null default 'basic';
alter table resumes add column if not exists cover_letter text;
create index if not exists resumes_device_day on resumes (device_id, created_at);
