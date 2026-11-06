-- Salary normalization for honest cross-market salary sorting.
--
-- Problem: sort=salary compared raw salary_max values — 900,000 JPY beat
-- 90,000 USD. Listings publish in mixed currencies and intervals (hourly,
-- weekly, monthly, annual), so no raw ordering is meaningful across markets.
--
-- Design: normalize every listing to approximate ANNUAL USD at write time
-- with a trigger (inserts come from the external JobSpy ingestor, which this
-- repo does not control — the trigger keeps normalization in the database
-- where every write path gets it for free). Interval factors mirror
-- PERIOD_FACTOR in lib/job-match/scoring-v1.ts (hourly 2080, daily 260,
-- weekly 52, monthly 12). FX rates are a versioned static seed
-- (fx-seed-2026-09), the same "declared snapshot" model the match engine
-- uses with FX_VERSION; refresh by updating fx_rates.
--
-- Honesty rule: unknown or missing currency normalizes to NULL, never a
-- guess. The UI continues to show only source-published salary text; these
-- columns exist purely for ordering. Additive and idempotent.

create table if not exists fx_rates (
  currency text primary key check (currency ~ '^[A-Z]{3}$'),
  usd_rate numeric not null check (usd_rate > 0),
  fx_version text not null,
  updated_at timestamptz not null default now()
);

insert into fx_rates (currency, usd_rate, fx_version) values
  ('USD', 1,       'fx-seed-2026-09'),
  ('EUR', 1.08,    'fx-seed-2026-09'),
  ('GBP', 1.27,    'fx-seed-2026-09'),
  ('CAD', 0.72,    'fx-seed-2026-09'),
  ('AUD', 0.65,    'fx-seed-2026-09'),
  ('NZD', 0.59,    'fx-seed-2026-09'),
  ('CHF', 1.12,    'fx-seed-2026-09'),
  ('JPY', 0.0066,  'fx-seed-2026-09'),
  ('INR', 0.0119,  'fx-seed-2026-09'),
  ('AED', 0.272,   'fx-seed-2026-09'),
  ('SGD', 0.74,    'fx-seed-2026-09'),
  ('BRL', 0.17,    'fx-seed-2026-09'),
  ('MXN', 0.050,   'fx-seed-2026-09'),
  ('PHP', 0.017,   'fx-seed-2026-09'),
  ('ZAR', 0.055,   'fx-seed-2026-09'),
  ('PLN', 0.25,    'fx-seed-2026-09'),
  ('NGN', 0.0006,  'fx-seed-2026-09')
on conflict (currency) do nothing;

-- One canonical normalizer so the trigger and the backfill can never drift.
create or replace function job_salary_annual_usd(amount numeric, interval_text text, currency_text text)
returns numeric
language sql
stable
as $$
  select case
    when amount is null or amount <= 0 then null
    else round(
      amount
      * case
          when interval_text ilike '%hour%' then 2080
          when interval_text ilike '%day%' then 260
          when interval_text ilike '%week%' then 52
          when interval_text ilike '%month%' then 12
          else 1
        end
      * (select usd_rate from fx_rates where currency = upper(currency_text))
    )
  end
$$;

alter table jobs
  add column if not exists salary_annual_usd_min numeric,
  add column if not exists salary_annual_usd_max numeric;

create or replace function jobs_salary_normalize() returns trigger
language plpgsql
as $$
begin
  new.salary_annual_usd_min := job_salary_annual_usd(new.salary_min, new.salary_interval, new.salary_currency);
  new.salary_annual_usd_max := job_salary_annual_usd(new.salary_max, new.salary_interval, new.salary_currency);
  return new;
end
$$;

drop trigger if exists jobs_salary_normalize_trg on jobs;
create trigger jobs_salary_normalize_trg
  before insert or update of salary_min, salary_max, salary_interval, salary_currency
  on jobs
  for each row execute function jobs_salary_normalize();

-- Backfill existing rows through the same function.
update jobs
set salary_annual_usd_min = job_salary_annual_usd(salary_min, salary_interval, salary_currency),
    salary_annual_usd_max = job_salary_annual_usd(salary_max, salary_interval, salary_currency)
where salary_min is not null or salary_max is not null;

-- Serves sort=salary. (A partial index on expires_at > now() would be nicer
-- but now() is not immutable, so the full-column btree is the honest option.)
create index if not exists jobs_salary_annual_sort_idx
  on jobs (salary_annual_usd_max desc nulls last);
