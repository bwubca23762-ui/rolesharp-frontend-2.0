-- Country guidance must retain evidence and never convert convention into a
-- mandatory employer rule. scripts/fix-countries.ts is the canonical updater;
-- this migration clears unsafe legacy yes/no photo claims until it is run.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ats_system_source_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ats_system_verified_at timestamptz;

UPDATE countries
SET rules = jsonb_set(
  COALESCE(rules, '{}'::jsonb) - 'photo',
  '{photoPolicy}',
  jsonb_build_object(
    'status', 'optional',
    'verified', false,
    'rationale', 'No verified employer-specific requirement is stored. Follow the vacancy; the privacy-safe default is no photo.'
  ),
  true
)
WHERE NOT (COALESCE(rules, '{}'::jsonb) ? 'photoPolicy');
