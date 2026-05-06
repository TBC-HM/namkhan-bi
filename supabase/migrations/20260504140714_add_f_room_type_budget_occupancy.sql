-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504140714
-- Name:    add_f_room_type_budget_occupancy
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Per-room-type budget occupancy reader. Reads from plan.drivers where the
-- scenario is the active budget AND room_type_id is populated. Returns []
-- when no per-room-type budget rows have been entered yet — the Pulse chart
-- gracefully drops the Budget series in that case.
CREATE OR REPLACE FUNCTION public.f_room_type_budget_occupancy(p_year int, p_month int)
RETURNS TABLE (room_type_id bigint, room_type_name text, budget_occupancy_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT
    rt.room_type_id,
    rt.room_type_name,
    d.value_numeric AS budget_occupancy_pct
  FROM plan.drivers d
  JOIN plan.scenarios s ON s.scenario_id = d.scenario_id
  JOIN public.room_types rt ON rt.room_type_id::text = d.room_type_id
  WHERE s.scenario_type = 'budget'
    AND s.status = 'approved'
    AND d.period_year = p_year
    AND d.period_month = p_month
    AND d.driver_key = 'occupancy_pct'
    AND d.room_type_id IS NOT NULL
    AND d.room_type_id <> '';
$$;
GRANT EXECUTE ON FUNCTION public.f_room_type_budget_occupancy(int, int) TO anon, authenticated, service_role;

-- RPC for the admin form to upsert one row at a time
CREATE OR REPLACE FUNCTION public.f_set_room_type_budget(
  p_year int,
  p_month int,
  p_room_type_id text,
  p_occupancy_pct numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_scenario_id uuid;
BEGIN
  SELECT scenario_id INTO v_scenario_id
  FROM plan.scenarios
  WHERE scenario_type='budget' AND status='approved' AND fiscal_year=p_year
  ORDER BY name DESC LIMIT 1;
  IF v_scenario_id IS NULL THEN
    RAISE EXCEPTION 'No approved budget scenario for fiscal_year %', p_year;
  END IF;
  -- Upsert via delete-then-insert (composite uniqueness on scenario+year+month+room_type+key)
  DELETE FROM plan.drivers
  WHERE scenario_id=v_scenario_id
    AND period_year=p_year
    AND period_month=p_month
    AND room_type_id=p_room_type_id
    AND driver_key='occupancy_pct';
  INSERT INTO plan.drivers(scenario_id, period_year, period_month, room_type_id, driver_key, value_numeric)
  VALUES (v_scenario_id, p_year, p_month, p_room_type_id, 'occupancy_pct', p_occupancy_pct);
END $$;
GRANT EXECUTE ON FUNCTION public.f_set_room_type_budget(int, int, text, numeric) TO service_role;