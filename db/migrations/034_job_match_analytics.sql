-- Privacy-minimized calibration events. No message, resume, token, protected
-- trait, free-form job description, or recipient field is stored here.

create table if not exists job_match_calibration_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job_match_id uuid not null,
  canonical_job_key text not null,
  score_version integer not null check (score_version > 0),
  event_type text not null check (event_type in (
    'shown','opened','dismissed','saved','manual_applied','approved_email','interview'
  )),
  fit_score integer not null check (fit_score between 0 and 100),
  confidence_score integer not null check (confidence_score between 0 and 100 and fit_score<=confidence_score),
  hard_blocked boolean not null,
  signal_snapshot jsonb not null,
  feature_versions jsonb not null,
  impression_at timestamptz not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (job_match_id,user_id) references job_matches(id,user_id) on delete cascade,
  check (occurred_at >= impression_at),
  check (jsonb_typeof(signal_snapshot)='array'),
  check (jsonb_typeof(feature_versions)='object')
);

create index if not exists job_match_calibration_user_time_idx
  on job_match_calibration_events(user_id,impression_at,occurred_at);
create index if not exists job_match_calibration_match_idx
  on job_match_calibration_events(job_match_id,event_type,occurred_at);
