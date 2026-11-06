-- 019_traffic_analytics.sql
-- Self-hosted page view analytics for the admin dashboard.
-- Tracks: path, referrer, country, device type, unique visitors via anonymous session id.

create table if not exists page_views (
  id            bigint generated always as identity primary key,
  path          text not null,                          -- e.g. /, /build, /blog/some-post
  referrer      text,                                    -- full referrer URL
  country_code  char(2),                                 -- ISO country from Cloudflare
  device_type   text not null default 'desktop',         -- desktop | mobile | tablet
  session_id    text not null,                           -- anonymous UUID stored in sessionStorage
  user_agent    text,                                    -- browser UA (for bot filtering)
  created_at    timestamptz not null default now()
);

-- Fast lookup: traffic by day + path for the admin dashboard
create index if not exists page_views_created_at_idx on page_views (created_at desc);

-- Partial index for path-only queries (e.g. top pages)
create index if not exists page_views_path_idx on page_views (path);

-- Partial index for day-level aggregation queries.
-- Use a fixed UTC date cast so the expression stays immutable and indexable.
create index if not exists page_views_day_idx on page_views (((created_at at time zone 'UTC')::date));

-- Auto-clean: keep 90 days of raw data, delete older
-- (Run via pg_cron or manually — safe to truncate, it's analytics only)
