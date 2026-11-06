-- Trigram index below needs pg_trgm; guard so a fresh DB doesn't fail.
create extension if not exists pg_trgm;

-- Company enrichment columns for richer autocomplete + SEO hubs.
-- industry = human GICS/industry label, website = canonical domain, logo_url = optional.
alter table companies add column if not exists industry   text;
alter table companies add column if not exists website    text;
alter table companies add column if not exists logo_url   text;

-- Country-scoped search/sort + ordered country list.
create index if not exists companies_country_idx       on companies (country_code);
create index if not exists companies_country_tier_name on companies (country_code, tier, name);
-- Trigram index on slug so acronym search (slug ilike '%tcs%') stays fast.
create index if not exists companies_slug_trgm on companies using gin (slug gin_trgm_ops);
