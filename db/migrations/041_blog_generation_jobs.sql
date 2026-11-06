-- Durable administrative blog-generation requests. PostgreSQL is authoritative;
-- BullMQ carries only the request id and may be safely reconstructed.
create table if not exists blog_generation_jobs (
  id uuid primary key,
  topic text not null check (char_length(topic) between 6 and 200),
  publish_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  result_slug text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_generation_jobs_recovery_idx
  on blog_generation_jobs(status, available_at, created_at)
  where status in ('pending', 'running');
