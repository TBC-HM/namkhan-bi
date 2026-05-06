-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503170554
-- Name:    compset_agent_use_smart_dates
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Update compset_agent config to use smart date picker instead of hardcoded offsets
UPDATE governance.agents
SET config = config || jsonb_build_object(
  'date_strategy', 'smart_demand_picker',
  'date_picker_function', 'revenue.pick_scrape_dates',
  'date_picker_params', jsonb_build_object(
    'phase_1_validation', jsonb_build_object('max_dates', 2, 'horizon_days', 60, 'min_score', 50),
    'daily_lean', jsonb_build_object('max_dates', 8, 'horizon_days', 120, 'min_score', 40),
    'ondemand_deep', jsonb_build_object('max_dates', 20, 'horizon_days', 180, 'min_score', 30)
  ),
  'fallback_dates', jsonb_build_object(
    'enabled', true,
    'reason', 'Used if pick_scrape_dates returns fewer than min_dates_floor',
    'min_dates_floor', 4,
    'fallback_offsets', jsonb_build_array(7, 14, 30, 60)
  )
),
updated_at = NOW()
WHERE code = 'compset_agent';
