-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503153811
-- Name:    compset_agent_activate_and_wire
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- 1. Update existing compset_agent: attach to property, set status, model, budget
UPDATE governance.agents
SET 
  property_id = 260955,
  status = 'beta',
  schedule_cron = '0 23 * * *',  -- 23:00 UTC = 06:00 ICT next day
  schedule_human = 'daily 06:00 ICT',
  model_id = 'claude-sonnet-4-6',
  monthly_budget_usd = 30,
  description = 'Daily 06:00 ICT. Scrapes public OTA rates (Booking, Agoda, Expedia, Trip, hotel direct) for active comp sets in revenue.competitor_set. Writes to revenue.competitor_rates. Read-only — proposes nothing. Pricing decisions handled by pricing_agent.',
  config = jsonb_build_object(
    'shop_dates_offsets', '[7, 14, 30, 60, 90]'::jsonb,
    'los_nights', '[1, 2, 3]'::jsonb,
    'geos', '["US", "GB", "SG"]'::jsonb,
    'occupancy_adults', 2,
    'refundable_only', false,
    'comp_set_filter', jsonb_build_object('set_types', '["manual"]'::jsonb, 'is_active', true),
    'max_requests_per_run', 500,
    'fail_threshold_pct', 30
  ),
  updated_at = now()
WHERE code = 'compset_agent';

-- 2. Add Nimble MCP to tools catalog
INSERT INTO governance.tools_catalog (
  tool_code, category, name, description, side_effect, reversible, requires_consent, cost_estimate, is_active
)
VALUES (
  'nimble_mcp',
  'external_api',
  'Nimbleway MCP: web scraping & extraction',
  'Hosted MCP server for OTA rate scraping. Tools: nimble_web_extract (URL → JSON), nimble_deep_web_search, nimble_crawl. Used by compset_agent for daily rate intel.',
  'external',
  true,
  false,
  '~$0.005-0.02 per request, ~500 req/day target',
  true
)
ON CONFLICT (tool_code) DO UPDATE
  SET description = EXCLUDED.description,
      cost_estimate = EXCLUDED.cost_estimate;

-- 3. Register Nimble secret reference in agent_secrets (pointer only, not value)
INSERT INTO governance.agent_secrets (
  agent_id, key, vault_secret_id, storage_location, secret_name, scope, notes
)
SELECT 
  a.agent_id,
  'nimble_api_key',
  NULL,
  'edge_function_secret',
  'NIMBLE_API_KEY',
  'compset_agent_only',
  'Nimbleway MCP bearer token. Stored as Supabase Edge Function Secret. Read at runtime via Deno.env.get(''NIMBLE_API_KEY''). Rotate every 90 days.'
FROM governance.agents a
WHERE a.code = 'compset_agent'
  AND NOT EXISTS (
    SELECT 1 FROM governance.agent_secrets s 
    WHERE s.agent_id = a.agent_id AND s.key = 'nimble_api_key'
  );

-- 4. Create a draft mandate: read-only, no proposals, no rate changes
INSERT INTO governance.mandates (
  property_id, code, name, description, category, status, notes
)
VALUES (
  260955,
  'compset_agent_v1',
  'Comp Set Agent — read-only rate intelligence',
  'compset_agent collects market rate data only. It does not propose, modify, or execute rate changes. It does not contact guests, OTAs, or any external system other than Nimbleway scraping. All scraped data is logged to revenue.competitor_rates with full audit trail via agent_run_id.',
  'revenue_intelligence',
  'active',
  'Initial mandate. Tightens later when comp_discovery_agent and pricing_agent integrations are wired.'
)
ON CONFLICT (code) DO NOTHING;

-- 5. Mandate rules for compset_agent
WITH mid AS (
  SELECT mandate_id FROM governance.mandates WHERE code = 'compset_agent_v1'
)
INSERT INTO governance.mandate_rules (mandate_id, rule_type, applies_to, numeric_value, text_value, list_value, severity, notes, unit)
SELECT m.mandate_id, r.rule_type, r.applies_to, r.numeric_value, r.text_value, r.list_value, r.severity, r.notes, r.unit
FROM mid m, (VALUES
  ('numeric_ceiling', 'requests_per_run',          500::numeric, NULL,                      NULL::text[], 'block', 'Hard cap on Nimble requests per run to control cost', 'requests'),
  ('numeric_ceiling', 'cost_usd_per_run',           5::numeric,  NULL,                      NULL::text[], 'block', 'Hard cap on $ cost per single agent run',              'usd'),
  ('numeric_ceiling', 'monthly_cost_usd',           50::numeric, NULL,                      NULL::text[], 'block', 'Hard monthly cost cap across all runs',                'usd'),
  ('enum_in',         'allowed_tool_categories',    NULL,        NULL,                      ARRAY['read','external_api'], 'block', 'Agent may only call read tools and external scraping tools', NULL),
  ('enum_not_in',     'forbidden_tool_codes',       NULL,        NULL,                      ARRAY['cloudbeds_rate_update','cloudbeds_post_charge','cloudbeds_send_message','email_send','whatsapp_send','review_post_reply','bank_initiate_payment','quickbooks_post_journal','supabase_write_proposal'], 'block', 'compset_agent must never write proposals, change rates, contact guests, or move money', NULL),
  ('boolean',         'may_create_proposals',       NULL,        'false',                   NULL,         'block', 'Read-only — proposals belong to pricing_agent and comp_discovery_agent', NULL),
  ('numeric_floor',   'min_data_completeness_pct',  70::numeric, NULL,                      NULL,         'warn',  'Warn if more than 30% of scrapes fail in a single run', 'pct')
) AS r(rule_type, applies_to, numeric_value, text_value, list_value, severity, notes, unit)
ON CONFLICT DO NOTHING;

-- 6. Cron trigger (active=false until first manual run validates)
INSERT INTO governance.agent_triggers (
  agent_id, trigger_type, cron_expr, is_active, config, notes
)
SELECT 
  a.agent_id,
  'cron',
  '0 23 * * *',  -- 23:00 UTC daily = 06:00 ICT
  false,         -- inactive until first manual test passes
  jsonb_build_object('timezone', 'UTC', 'human', 'daily 06:00 ICT'),
  'Daily rate scrape. Disabled until compset_agent has been validated with at least one successful manual run.'
FROM governance.agents a
WHERE a.code = 'compset_agent'
  AND NOT EXISTS (
    SELECT 1 FROM governance.agent_triggers t
    WHERE t.agent_id = a.agent_id AND t.trigger_type = 'cron'
  );

-- 7. Manual trigger for testing
INSERT INTO governance.agent_triggers (
  agent_id, trigger_type, is_active, config, notes
)
SELECT 
  a.agent_id,
  'manual',
  true,
  jsonb_build_object('callable_from', ARRAY['namkhan-bi-app', 'edge_function_invoke']),
  'Manual run for testing and ad-hoc scrapes. Always available.'
FROM governance.agents a
WHERE a.code = 'compset_agent'
  AND NOT EXISTS (
    SELECT 1 FROM governance.agent_triggers t
    WHERE t.agent_id = a.agent_id AND t.trigger_type = 'manual'
  );
