-- Country-aware job discovery cache. Listings are deliberately short-lived:
-- RoleSharp is a fresh search index, not a permanent copy of job-board data.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  title text not null,
  company text not null,
  country_code char(2) not null,
  location text,
  city text,
  state_region text,
  is_remote boolean not null default false,
  job_type text,
  description text,
  apply_url text not null,
  source_url text,
  company_url text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_interval text,
  date_posted timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  metadata jsonb not null default '{}'::jsonb,
  unique (provider, external_id)
);

create index if not exists jobs_country_fresh_idx on jobs (country_code, date_posted desc nulls last, last_seen_at desc);
create index if not exists jobs_type_idx on jobs (country_code, job_type, is_remote);
create index if not exists jobs_title_trgm_idx on jobs using gin (title gin_trgm_ops);
create index if not exists jobs_company_trgm_idx on jobs using gin (company gin_trgm_ops);
create index if not exists jobs_expiry_idx on jobs (expires_at);

create table if not exists job_search_profiles (
  id bigserial primary key,
  country_code char(2) not null,
  country_name text not null,
  location text not null,
  search_term text not null,
  providers text[] not null default '{indeed}',
  enabled boolean not null default true,
  refresh_hours int not null default 12 check (refresh_hours between 1 and 168),
  next_run_at timestamptz not null default now(),
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures int not null default 0,
  unique (country_code, search_term)
);
create index if not exists job_profiles_due_idx on job_search_profiles (enabled, next_run_at);

create table if not exists job_ingestion_runs (
  id bigserial primary key,
  profile_id bigint references job_search_profiles(id) on delete set null,
  country_code char(2),
  search_term text,
  providers text[],
  status text not null default 'running',
  fetched_count int not null default 0,
  stored_count int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists job_runs_recent_idx on job_ingestion_runs (started_at desc);

-- Eight broad role families across RoleSharp's nine launch markets. Profiles
-- are staggered over two hours so the first service start does not burst.
with markets(priority, code, name, location, providers) as (
  values
    (1,'IN','India','India',array['indeed']::text[]),
    (2,'US','United States','United States',array['indeed']::text[]),
    (3,'GB','United Kingdom','United Kingdom',array['indeed']::text[]),
    (4,'CA','Canada','Canada',array['indeed']::text[]),
    (5,'AE','United Arab Emirates','United Arab Emirates',array['indeed']::text[]),
    (6,'DE','Germany','Germany',array['indeed']::text[]),
    (7,'FR','France','France',array['indeed']::text[]),
    (8,'ES','Spain','Spain',array['indeed']::text[]),
    (9,'JP','Japan','Japan',array['indeed']::text[])
), terms(term) as (
  values ('software engineer'),('data analyst'),('product manager'),('marketing'),
         ('sales'),('finance'),('customer success'),('internship')
), profiles as (
  select code, name, location, term, providers,
         row_number() over (order by priority, term) - 1 as sequence
  from markets cross join terms
)
insert into job_search_profiles (country_code, country_name, location, search_term, providers, next_run_at)
select code, name, location, term, providers, now() + sequence * interval '20 seconds'
from profiles
on conflict (country_code, search_term) do update set
  country_name=excluded.country_name,
  location=excluded.location,
  providers=excluded.providers;
