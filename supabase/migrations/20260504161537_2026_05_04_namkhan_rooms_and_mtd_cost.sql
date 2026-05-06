-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504161537
-- Name:    2026_05_04_namkhan_rooms_and_mtd_cost
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- 1. Fix Namkhan room count: 20 → 24 (selling capacity per memory)
UPDATE revenue.competitor_property
SET rooms = 24
WHERE is_self = true;

-- 2. Backfill MTD cost from agent_runs sum
UPDATE governance.agents a
SET month_to_date_cost_usd = COALESCE((
  SELECT SUM(cost_usd) FROM governance.agent_runs r
  WHERE r.agent_id = a.agent_id
    AND r.started_at >= date_trunc('month', now())
), 0);

-- 3. Patch compset_run_finish to keep MTD cost in sync going forward
CREATE OR REPLACE FUNCTION public.compset_run_finish(
  p_run_id uuid, p_status text, p_output jsonb,
  p_duration_ms int, p_cost_usd numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'governance'
AS $function$
DECLARE v_agent_id uuid;
BEGIN
  UPDATE governance.agent_runs
  SET status = p_status,
      finished_at = now(),
      duration_ms = p_duration_ms,
      cost_usd = p_cost_usd,
      output = p_output
  WHERE run_id = p_run_id
  RETURNING agent_id INTO v_agent_id;

  -- Keep TopStrip MTD cost fresh
  UPDATE governance.agents a
  SET month_to_date_cost_usd = COALESCE((
        SELECT SUM(cost_usd) FROM governance.agent_runs r
        WHERE r.agent_id = a.agent_id
          AND r.started_at >= date_trunc('month', now())
      ), 0),
      last_run_at = now()
  WHERE a.agent_id = v_agent_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compset_run_finish(uuid,text,jsonb,int,numeric) TO service_role;

-- Verify
SELECT 'rooms' AS k, property_name, rooms FROM revenue.competitor_property WHERE is_self=true
UNION ALL
SELECT 'mtd', code, month_to_date_cost_usd FROM governance.agents WHERE code IN ('compset_agent','comp_discovery_agent');
