-- Job/application tracker (stickiness feature, à la Teal). Logged-in users save
-- the jobs they're applying to and move them through a pipeline.
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id_text text not null,
  company text not null,
  role text not null,
  status text not null default 'saved',   -- saved | applied | interview | offer | rejected
  job_url text,
  notes text,
  resume_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_user_idx on applications (user_id_text, created_at desc);
