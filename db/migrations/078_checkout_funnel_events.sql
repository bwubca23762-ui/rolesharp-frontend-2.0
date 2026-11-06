-- Checkout events are privacy-safe, allowlisted funnel markers. They contain
-- no payment references, personal data, price, or provider payloads; the
-- existing context key is limited to values such as billing:razorpay:yearly.
alter table product_events drop constraint if exists product_events_name_check;

alter table product_events add constraint product_events_name_check check (event_name in (
  'nav_menu_open',
  'nav_item_select',
  'featured_workflow_select',
  'demo_view',
  'demo_step',
  'demo_complete',
  'demo_cta_select',
  'tool_meaningful_start',
  'tool_start_blocked',
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
  'pricing_boundary_view',
  'checkout_intent',
  'checkout_provider_selected',
  'checkout_started',
  'checkout_cancelled',
  'checkout_failed',
  'checkout_verified'
));
