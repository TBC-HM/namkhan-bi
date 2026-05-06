-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504144511
-- Name:    2026_05_04_compset_run_progress_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION public.compset_run_progress(p_run_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'governance', 'revenue'
AS $$
  SELECT jsonb_build_object(
    'run_id',       r.run_id,
    'status',       r.status,
    'started_at',   r.started_at,
    'finished_at',  r.finished_at,
    'duration_ms',  r.duration_ms,
    'cost_usd',     r.cost_usd,
    'jobs_total',   COALESCE((r.input ->> 'jobs_count')::int, (r.output ->> 'jobs_count')::int),
    'success',      (r.output ->> 'success')::int,
    'failed',       (r.output ->> 'failed')::int,
    'crash_error',  r.output ->> 'crash_error',
    'rates_so_far', COALESCE((SELECT COUNT(*) FROM revenue.competitor_rates WHERE agent_run_id = r.run_id)::int, 0),
    'is_done',      r.status <> 'running'
  )
  FROM governance.agent_runs r
  WHERE r.run_id = p_run_id;
$$;

GRANT EXECUTE ON FUNCTION public.compset_run_progress(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.compset_run_progress(uuid) IS
  'Returns live progress for a single compset agent run. SECURITY DEFINER so it bypasses '
  'pgrst.db_schemas + RLS for the rate count. Polled by /api/compset/run/status.';
