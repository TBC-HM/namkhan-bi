-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503232739
-- Name:    2026_05_04_rate_shop_findings_repair_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- Repair migration v2 for the 6 rate-shop findings flagged 2026-05-03.
-- v1 failed because uq_comp_rates_cell was a standalone INDEX (not CONSTRAINT)
-- with COALESCE wrappers around mealplan/is_refundable. Functionally equivalent
-- to NULLS NOT DISTINCT for dedupe, but blocks PostgREST onConflict upserts
-- (per documented bug feedback_postgrest_onconflict_expression_index_bug).
--
-- Pre-flight verified: 23 rates exist, 0 collisions under NULLS NOT DISTINCT,
-- 0 dangling FKs, all room_type_target NULL, only channel = 'booking'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- #1 — COALESCE expression INDEX → CONSTRAINT with NULLS NOT DISTINCT
--      Equivalent dedupe semantics + restores PostgREST onConflict support
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS revenue.uq_comp_rates_cell;

ALTER TABLE revenue.competitor_rates
  ADD CONSTRAINT uq_comp_rates_cell
  UNIQUE NULLS NOT DISTINCT
    (comp_id, stay_date, shop_date, channel, los_nights, geo_market,
     mealplan, is_refundable);

COMMENT ON CONSTRAINT uq_comp_rates_cell ON revenue.competitor_rates IS
  'Replaces COALESCE expression index. NULLS NOT DISTINCT keeps dedupe semantics '
  'and restores PostgREST onConflict upsert support.';

-- ----------------------------------------------------------------------------
-- #2 — agent_run_id FK: SET NULL → RESTRICT
-- ----------------------------------------------------------------------------
ALTER TABLE revenue.competitor_rates
  DROP CONSTRAINT IF EXISTS competitor_rates_agent_run_id_fkey;

ALTER TABLE revenue.competitor_rates
  ADD CONSTRAINT competitor_rates_agent_run_id_fkey
  FOREIGN KEY (agent_run_id)
  REFERENCES governance.agent_runs(run_id)
  ON DELETE RESTRICT;

COMMENT ON CONSTRAINT competitor_rates_agent_run_id_fkey
  ON revenue.competitor_rates IS
  'RESTRICT (not SET NULL) — audit trail must survive. Archive runs, never delete.';

-- ----------------------------------------------------------------------------
-- #5 — FX source tracking
-- ----------------------------------------------------------------------------
ALTER TABLE revenue.competitor_rates
  ADD COLUMN IF NOT EXISTS fx_source   text,
  ADD COLUMN IF NOT EXISTS fx_as_of_ts timestamptz;

COMMENT ON COLUMN revenue.competitor_rates.fx_source IS
  'FX feed identifier (e.g. ''gl.fx_rates'', ''ECB''). NULL allowed for USD-native rates.';
COMMENT ON COLUMN revenue.competitor_rates.fx_as_of_ts IS
  'Snapshot timestamp of the FX rate used. Critical for retro USD comparison.';

-- ----------------------------------------------------------------------------
-- #3 — room_type_target CHECK with industry-standard list
-- ----------------------------------------------------------------------------
ALTER TABLE revenue.competitor_property
  DROP CONSTRAINT IF EXISTS competitor_property_room_type_target_check;

ALTER TABLE revenue.competitor_property
  ADD CONSTRAINT competitor_property_room_type_target_check
  CHECK (
    room_type_target IS NULL
    OR room_type_target IN (
      'standard','superior','deluxe','executive',
      'junior_suite','suite','penthouse',
      'family','studio',
      'villa','bungalow','cottage'
    )
  );

COMMENT ON CONSTRAINT competitor_property_room_type_target_check
  ON revenue.competitor_property IS
  'Closed list of comp room categories. Extend via DROP+ADD CONSTRAINT (cheap).';

-- ----------------------------------------------------------------------------
-- #6 — Cost-cap surface: governance.agent_budgets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance.agent_budgets (
  agent_id          uuid PRIMARY KEY
                    REFERENCES governance.agents(agent_id) ON DELETE CASCADE,
  daily_cap_usd     numeric(10,2) NOT NULL CHECK (daily_cap_usd > 0),
  monthly_cap_usd   numeric(10,2) NOT NULL CHECK (monthly_cap_usd > 0),
  enforced          boolean NOT NULL DEFAULT true,
  notes             text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_gte_daily CHECK (monthly_cap_usd >= daily_cap_usd)
);

COMMENT ON TABLE governance.agent_budgets IS
  'Per-agent cost ceiling. Edge Functions should query this BEFORE each scrape '
  'batch and halt if MTD spend > monthly_cap or today spend > daily_cap. '
  'enforced=false to bypass for backfills. Not yet wired into compset-agent-run.';

GRANT SELECT ON governance.agent_budgets TO authenticated, anon;
GRANT ALL    ON governance.agent_budgets TO service_role;

INSERT INTO governance.agent_budgets (agent_id, daily_cap_usd, monthly_cap_usd, notes)
SELECT a.agent_id,
       LEAST(GREATEST(a.monthly_budget_usd / 30.0, 1), a.monthly_budget_usd) AS daily_cap_usd,
       a.monthly_budget_usd                                                  AS monthly_cap_usd,
       'Seeded from agents.monthly_budget_usd on ' || now()::date::text
FROM governance.agents a
WHERE a.monthly_budget_usd > 0
ON CONFLICT (agent_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Verification block (TX aborts if any check fails)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  uq_def text;
  fk_action char(1);
  rt_def text;
  fx_count int;
  budget_count int;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO uq_def
  FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
  WHERE n.nspname='revenue' AND c.conname='uq_comp_rates_cell';
  IF uq_def IS NULL OR uq_def NOT ILIKE '%NULLS NOT DISTINCT%' THEN
    RAISE EXCEPTION '#1 fail: got %', uq_def;
  END IF;

  SELECT confdeltype INTO fk_action
  FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
  WHERE n.nspname='revenue' AND c.conname='competitor_rates_agent_run_id_fkey';
  IF fk_action <> 'r' THEN
    RAISE EXCEPTION '#2 fail: action=%', fk_action;
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO rt_def
  FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
  WHERE n.nspname='revenue' AND c.conname='competitor_property_room_type_target_check';
  IF rt_def IS NULL THEN RAISE EXCEPTION '#3 fail: not created'; END IF;

  SELECT COUNT(*) INTO fx_count FROM information_schema.columns
  WHERE table_schema='revenue' AND table_name='competitor_rates'
    AND column_name IN ('fx_source','fx_as_of_ts');
  IF fx_count <> 2 THEN RAISE EXCEPTION '#5 fail: cols=%', fx_count; END IF;

  SELECT COUNT(*) INTO budget_count FROM governance.agent_budgets;
  IF budget_count < 1 THEN RAISE EXCEPTION '#6 fail: 0 rows'; END IF;

  RAISE NOTICE 'OK — 5 repair items verified. Budgets seeded for % agents.', budget_count;
END $$;
