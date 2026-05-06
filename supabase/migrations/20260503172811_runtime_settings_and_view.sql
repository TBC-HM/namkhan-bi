-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503172811
-- Name:    runtime_settings_and_view
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


ALTER TABLE governance.agents ADD COLUMN IF NOT EXISTS runtime_settings JSONB DEFAULT '{}'::jsonb;

UPDATE governance.agents
SET runtime_settings = jsonb_build_object(
  'picker_mode', 'daily_lean',
  'picker_max_dates', 8,
  'picker_horizon_days', 120,
  'picker_min_score', 40,
  'default_geo_markets', jsonb_build_array('US'),
  'default_los_nights', 1,
  'cron_enabled', false,
  'cron_schedule', '0 23 * * *',
  'cron_schedule_human', 'Daily at 06:00 ICT',
  'channels_to_scrape', jsonb_build_array('booking','agoda','direct'),
  'phase', 'phase_1_validation'
)
WHERE code = 'compset_agent';

DROP VIEW IF EXISTS governance.agent_settings_for_rm;
CREATE VIEW governance.agent_settings_for_rm AS
SELECT 
  a.agent_id, a.code, a.name, a.status, a.pillar, a.runtime_settings,
  jsonb_build_object(
    'monthly_budget_usd', a.monthly_budget_usd,
    'month_to_date_cost_usd', a.month_to_date_cost_usd,
    'mandate_rules', (
      SELECT jsonb_agg(jsonb_build_object(
        'rule_type', mr.rule_type, 'applies_to', mr.applies_to,
        'numeric_value', mr.numeric_value, 'text_value', mr.text_value,
        'unit', mr.unit, 'severity', mr.severity, 'notes', mr.notes
      ))
      FROM governance.mandate_rules mr
      JOIN governance.mandates m ON m.mandate_id = mr.mandate_id
      WHERE m.code LIKE a.code || '%' AND m.status = 'active'
    )
  ) AS locked_by_mandate
FROM governance.agents a
WHERE a.code IN ('compset_agent','comp_discovery_agent');
