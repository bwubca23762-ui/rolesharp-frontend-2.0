-- Keep formal occupation names for page content while allowing concise,
-- human-curated search titles. Existing imports remain backward-compatible.
alter table roles add column if not exists seo_title text;

alter table roles drop constraint if exists roles_seo_title_length;
alter table roles
  add constraint roles_seo_title_length
  check (seo_title is null or char_length(trim(seo_title)) between 2 and 48);

update roles
set seo_title = case slug
  when 'advertising-and-promotions-managers' then 'Advertising Manager'
  when 'airline-pilots-copilots-and-flight-engineers' then 'Airline Pilot'
  when 'architects-except-landscape-and-naval' then 'Architect'
  when 'claims-adjusters-examiners-and-investigators' then 'Claims Adjuster'
  when 'computer-and-information-systems-managers' then 'IT Manager'
  when 'computer-systems-analysts' then 'Systems Analyst'
  when 'customer-service-representatives' then 'Customer Service Rep'
  when 'dispatchers-except-police-fire-and-ambulance' then 'Dispatcher'
  when 'financial-and-investment-analysts' then 'Financial Analyst'
  when 'first-line-supervisors-of-retail-sales-workers' then 'Retail Supervisor'
  when 'general-and-operations-managers' then 'Operations Manager'
  when 'geoscientists-except-hydrologists-and-geographers' then 'Geoscientist'
  when 'heavy-and-tractor-trailer-truck-drivers' then 'Truck Driver'
  when 'human-resources-specialists' then 'HR Specialist'
  when 'industrial-production-managers' then 'Production Manager'
  when 'information-security-analysts' then 'Cybersecurity Analyst'
  when 'market-research-analysts-and-marketing-specialists' then 'Market Research Analyst'
  when 'medical-and-health-services-managers' then 'Healthcare Manager'
  when 'medical-scientists-except-epidemiologists' then 'Medical Scientist'
  when 'network-and-computer-systems-administrators' then 'Systems Administrator'
  when 'operations-research-analysts' then 'Operations Analyst'
  when 'personal-financial-advisors' then 'Financial Advisor'
  when 'project-management-specialists' then 'Project Manager'
  when 'public-relations-specialists' then 'PR Specialist'
  when 'quality-control-analysts' then 'Quality Analyst'
  when 'securities-commodities-and-financial-services-sales-agents' then 'Financial Services Sales'
  when 'software-quality-assurance-analysts-and-testers' then 'Software QA Analyst'
  when 'teachers-and-instructors-all-other' then 'Teacher'
  when 'training-and-development-specialists' then 'Training Specialist'
  when 'transportation-storage-and-distribution-managers' then 'Logistics Manager'
  when 'welders-cutters-solderers-and-brazers' then 'Welder'
  when 'wind-turbine-service-technicians' then 'Wind Turbine Technician'
  when 'farmers-ranchers-and-other-agricultural-managers' then 'Agricultural Manager'
  else seo_title
end
where slug in (
  'claims-adjusters-examiners-and-investigators',
  'advertising-and-promotions-managers',
  'airline-pilots-copilots-and-flight-engineers',
  'architects-except-landscape-and-naval',
  'computer-and-information-systems-managers',
  'computer-systems-analysts',
  'customer-service-representatives',
  'dispatchers-except-police-fire-and-ambulance',
  'financial-and-investment-analysts',
  'first-line-supervisors-of-retail-sales-workers',
  'general-and-operations-managers',
  'geoscientists-except-hydrologists-and-geographers',
  'heavy-and-tractor-trailer-truck-drivers',
  'human-resources-specialists',
  'industrial-production-managers',
  'information-security-analysts',
  'market-research-analysts-and-marketing-specialists',
  'medical-and-health-services-managers',
  'medical-scientists-except-epidemiologists',
  'network-and-computer-systems-administrators',
  'operations-research-analysts',
  'personal-financial-advisors',
  'project-management-specialists',
  'public-relations-specialists',
  'quality-control-analysts',
  'securities-commodities-and-financial-services-sales-agents',
  'software-quality-assurance-analysts-and-testers',
  'teachers-and-instructors-all-other',
  'training-and-development-specialists',
  'transportation-storage-and-distribution-managers',
  'welders-cutters-solderers-and-brazers',
  'wind-turbine-service-technicians',
  'farmers-ranchers-and-other-agricultural-managers'
);
