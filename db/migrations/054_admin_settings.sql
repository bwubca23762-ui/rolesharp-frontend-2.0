-- Owner-editable platform settings. Key/value rows so new knobs do not need a
-- schema change; the first consumer is the usage-limit override read by
-- lib/settings.ts (env vars remain the fallback and the bound for validation).
create table if not exists admin_settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,80}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
