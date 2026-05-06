-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505154131
-- Name:    agent_runner_helpers_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =========================================================
-- agent_runner_helpers_v1 — supporting SQL for agent-runner
-- Phase 1 MVP: only variance_agent is claimable
-- =========================================================

-- 1. Atomic queue claim. Returns claimed runs and flips status='running'.
--    SKIP LOCKED prevents double-pickup if invocations overlap.
--    PHASE 1 GATE: only variance_agent is claimable. Phase 2 expands the IN list.
CREATE OR REPLACE FUNCTION governance.agent_runner_claim_runs(p_limit int DEFAULT 3)
RETURNS TABLE (
  run_id uuid,
  agent_id uuid,
  agent_code text,
  prompt_id uuid,
  property_id bigint,
  input jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT r.run_id
    FROM governance.agent_runs r
    JOIN governance.agents a ON a.agent_id = r.agent_id
    WHERE r.status = 'queued'
      AND a.status = 'active'
      AND a.code IN ('variance_agent')   -- PHASE 1: variance only
    ORDER BY r.started_at ASC
    LIMIT p_limit
    FOR UPDATE OF r SKIP LOCKED
  ),
  upd AS (
    UPDATE governance.agent_runs r
    SET status = 'running'
    FROM claimed
    WHERE r.run_id = claimed.run_id
    RETURNING r.run_id, r.agent_id, r.prompt_id, r.property_id, r.input
  )
  SELECT u.run_id, u.agent_id, a.code AS agent_code, u.prompt_id, u.property_id, u.input
  FROM upd u
  JOIN governance.agents a ON a.agent_id = u.agent_id;
END;
$$;

REVOKE ALL ON FUNCTION governance.agent_runner_claim_runs(int) FROM public;
GRANT EXECUTE ON FUNCTION governance.agent_runner_claim_runs(int) TO service_role;

-- 2. Stats updater. Bumps last_run_at, totals, MTD cost on the agent row.
CREATE OR REPLACE FUNCTION governance.agent_runner_update_stats(
  p_agent_id uuid,
  p_cost_usd numeric,
  p_proposal_count int,
  p_succeeded boolean DEFAULT true
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE governance.agents SET
    last_run_at = now(),
    last_success_at = CASE WHEN p_succeeded THEN now() ELSE last_success_at END,
    total_runs = COALESCE(total_runs, 0) + 1,
    total_proposals = COALESCE(total_proposals, 0) + COALESCE(p_proposal_count, 0),
    month_to_date_cost_usd = COALESCE(month_to_date_cost_usd, 0) + COALESCE(p_cost_usd, 0),
    updated_at = now()
  WHERE agent_id = p_agent_id;
$$;

REVOKE ALL ON FUNCTION governance.agent_runner_update_stats(uuid, numeric, int, boolean) FROM public;
GRANT EXECUTE ON FUNCTION governance.agent_runner_update_stats(uuid, numeric, int, boolean) TO service_role;

-- 3. Sandboxed SELECT executor for input_sources(kind=sql_query|sql_view).
--    Hard rule: caller must pass a SELECT or CTE; multiple statements rejected;
--    LIMIT enforced via outer wrap; result returned as jsonb array.
CREATE OR REPLACE FUNCTION governance.agent_runner_run_query(
  p_sql text,
  p_limit int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, gl, governance, revenue, ops, frontoffice, kpi, guest, sales, pricing, pos, suppliers, fa, inv, proc
AS $$
DECLARE
  cleaned text;
  result  jsonb;
BEGIN
  IF p_sql IS NULL OR length(trim(p_sql)) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  cleaned := regexp_replace(p_sql, ';\s*$', '');   -- strip trailing semicolon
  IF cleaned ~ ';\s*\S' THEN
    RAISE EXCEPTION 'agent_runner_run_query: multiple statements not allowed';
  END IF;

  IF lower(ltrim(cleaned)) NOT LIKE 'select %'
     AND lower(ltrim(cleaned)) NOT LIKE 'with %'
  THEN
    RAISE EXCEPTION 'agent_runner_run_query: only SELECT/CTE permitted';
  END IF;

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (SELECT * FROM (%s) sub LIMIT %s) t',
    cleaned, GREATEST(1, LEAST(p_limit, 1000))
  ) INTO result;

  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION governance.agent_runner_run_query(text, int) FROM public;
GRANT EXECUTE ON FUNCTION governance.agent_runner_run_query(text, int) TO service_role;

COMMENT ON FUNCTION governance.agent_runner_claim_runs IS
  'Atomically claims queued runs for the agent-runner Edge Function. Phase 1 filter: variance_agent only.';
COMMENT ON FUNCTION governance.agent_runner_update_stats IS
  'Bumps agent stats after a run completes. Called by agent-runner Edge Function.';
COMMENT ON FUNCTION governance.agent_runner_run_query IS
  'Sandboxed read-only SQL executor used by agent-runner to materialize prompt input_sources.';
