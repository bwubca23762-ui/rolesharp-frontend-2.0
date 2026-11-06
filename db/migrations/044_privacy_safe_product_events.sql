-- Privacy-safe, allowlisted product events for workflow continuity measurement.
-- No resume text, job descriptions, email addresses, application notes,
-- query strings, raw referrers, or raw user-agent strings are stored here.

create table if not exists product_events (
  id            bigint generated always as identity primary key,
  event_name    text not null,
  path          text not null,
  page_family   text not null,
  device_class  text not null,
  auth_state    text not null,
  context_key   text,
  country_code  char(2),
  session_id    uuid not null,
  created_at    timestamptz not null default now(),
  constraint product_events_name_check check (event_name in (
    'nav_menu_open',
    'nav_item_select',
    'featured_workflow_select',
    'demo_view',
    'demo_step',
    'demo_complete',
    'demo_cta_select',
    'tool_meaningful_start',
    'first_value_view',
    'auth_start',
    'auth_verified',
    'destination_resumed',
    'workflow_handoff',
    'template_preview',
    'template_use',
    'example_view',
    'example_use',
    'methodology_view',
    'source_open',
    'pricing_boundary_view'
  )),
  constraint product_events_page_family_check check (page_family in (
    'marketing', 'tool', 'auth', 'workspace', 'directory', 'editorial', 'legal', 'unknown'
  )),
  constraint product_events_device_class_check check (device_class in ('mobile', 'tablet', 'desktop')),
  constraint product_events_auth_state_check check (auth_state in ('anonymous', 'authenticated', 'unknown')),
  constraint product_events_path_check check (path ~ '^/[A-Za-z0-9/_-]*$' and length(path) <= 240),
  constraint product_events_context_check check (
    context_key is null or (context_key ~ '^[A-Za-z0-9:_-]+$' and length(context_key) <= 80)
  )
);

create index if not exists product_events_created_at_idx on product_events (created_at desc);
create index if not exists product_events_name_created_at_idx on product_events (event_name, created_at desc);
create index if not exists product_events_family_created_at_idx on product_events (page_family, created_at desc);

-- Raw product-event retention is intentionally shorter than page-view retention.
-- A scheduled maintenance job may delete rows older than 60 days.
