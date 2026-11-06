-- Broaden sector coverage in the nine launch markets without changing the
-- existing searches or creating a simultaneous burst of provider requests.
with markets as (
  select distinct on (country_code) country_code,country_name,location,providers
  from job_search_profiles
  where enabled and country_code in ('IN','US','GB','CA','AE','DE','FR','ES','JP')
  order by country_code,refresh_hours,id
), sectors(search_term) as (
  values ('healthcare'),('education'),('logistics'),('hospitality'),('retail'),('operations')
), additions as (
  select markets.*,sectors.search_term,
    row_number() over (order by country_code,sectors.search_term) as sequence
  from markets cross join sectors
)
insert into job_search_profiles(country_code,country_name,location,search_term,providers,refresh_hours,next_run_at)
select country_code,country_name,location,search_term,providers,24,
  now()+sequence*interval '25 minutes'
from additions
on conflict(country_code,search_term) do nothing;
