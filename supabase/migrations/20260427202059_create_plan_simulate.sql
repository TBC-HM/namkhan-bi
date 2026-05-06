-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427202059
-- Name:    create_plan_simulate
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- plan.simulate(): clone a base scenario with driver overrides
-- driver_overrides JSON example:
-- {
--   "rooms_revenue_pct": -0.20,         -- reduce all 708010 by 20%
--   "occupancy_pct": -0.15,             -- reduce occupancy
--   "wages_pct": 0.05,                  -- increase wages 5%
--   "specific": [
--     {"account_code": "624108", "month": null, "delta_pct": 0.10}  -- bump Booking.com 10%
--   ]
-- }

CREATE OR REPLACE FUNCTION plan.simulate(
  p_base_scenario_name text,
  p_new_scenario_name text,
  p_overrides jsonb DEFAULT '{}'::jsonb,
  p_fiscal_year int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_id uuid;
  v_new_id uuid;
  v_year int;
BEGIN
  SELECT scenario_id, fiscal_year INTO v_base_id, v_year
  FROM plan.scenarios WHERE name = p_base_scenario_name LIMIT 1;
  
  IF v_base_id IS NULL THEN
    RAISE EXCEPTION 'Base scenario % not found', p_base_scenario_name;
  END IF;
  
  v_year := COALESCE(p_fiscal_year, v_year);

  -- Create new scenario
  INSERT INTO plan.scenarios (property_id, name, scenario_type, fiscal_year, status, created_by, parent_scenario_id, notes)
  VALUES (260955, p_new_scenario_name, 'forecast', v_year, 'draft', 
          'plan.simulate', v_base_id,
          'Simulated from ' || p_base_scenario_name || ' with overrides: ' || p_overrides::text)
  RETURNING scenario_id INTO v_new_id;

  -- Clone lines with adjustments applied
  INSERT INTO plan.lines (scenario_id, period_year, period_month, account_code, amount_usd, notes)
  SELECT 
    v_new_id,
    pl.period_year,
    pl.period_month,
    pl.account_code,
    pl.amount_usd
      * (1 + COALESCE(
          CASE 
            WHEN m.usali_dept = 'Rooms' AND m.usali_account_type = 'Revenue' 
              THEN (p_overrides->>'rooms_revenue_pct')::numeric
            WHEN m.usali_dept = 'F&B' AND m.usali_account_type = 'Revenue' 
              THEN (p_overrides->>'fb_revenue_pct')::numeric
            WHEN m.usali_account_type = 'Wages' 
              THEN (p_overrides->>'wages_pct')::numeric
            WHEN m.usali_account_type = 'Other Expense' 
              THEN (p_overrides->>'opex_pct')::numeric
            ELSE 0
          END, 0)),
    'Simulated from ' || p_base_scenario_name
  FROM plan.lines pl
  JOIN plan.account_map m ON m.account_code = pl.account_code
  WHERE pl.scenario_id = v_base_id;

  -- Apply per-account specific overrides
  IF p_overrides ? 'specific' THEN
    UPDATE plan.lines pl
    SET amount_usd = pl.amount_usd * (1 + (sp->>'delta_pct')::numeric)
    FROM jsonb_array_elements(p_overrides->'specific') sp
    WHERE pl.scenario_id = v_new_id
      AND pl.account_code = sp->>'account_code'
      AND ((sp->>'month') IS NULL OR pl.period_month = (sp->>'month')::int);
  END IF;

  RETURN v_new_id;
END;
$$;