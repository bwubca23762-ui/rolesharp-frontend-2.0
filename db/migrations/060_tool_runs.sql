-- Tool-run history (Platform Premium feature, lib/tier-features.ts
-- toolHistory). Records the moment a premium account runs a tool — ATS
-- checks carry their score so the viewer can show a trend over time.
-- resume_id is nullable: checker runs start before a resume exists (the
-- build flow scores the upload first, saves later). User-scoped, not
-- resume-scoped, in v1 — see ROLESHARP-PROGRESS 2026-08-29.
create table if not exists tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tool text not null,
  score int,
  summary text,
  created_at timestamptz not null default now()
);
create index if not exists tool_runs_user_created_idx on tool_runs (user_id, created_at desc);
