-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504232802
-- Name:    retreat_compiler_v14_discount_rate_meta
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

ALTER TABLE compiler.variants
  ADD COLUMN IF NOT EXISTS operator_discount_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_plan_id bigint,
  ADD COLUMN IF NOT EXISTS rate_plan_name text,
  ADD COLUMN IF NOT EXISTS room_rate_median_usd numeric,
  ADD COLUMN IF NOT EXISTS room_rate_min_usd numeric,
  ADD COLUMN IF NOT EXISTS room_rate_max_usd numeric,
  ADD COLUMN IF NOT EXISTS room_rate_days int;

-- v_compset_agent_settings is the compset version. Compiler agent runtime will
-- be added later once we register retreat_compiler_agent in governance.agents.
COMMENT ON COLUMN compiler.variants.operator_discount_usd IS 'Manual operator discount applied on top of computed total. Saved separately so it survives rebuilds.';