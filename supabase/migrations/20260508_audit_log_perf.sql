-- Migration: cockpit_audit_log insert performance optimizations
-- Ticket #229 (child of Perf marathon #229)
-- Author: Code Carla (code_writer agent)
-- Date: 2026-05-08
--
-- FINDINGS from audit log profiling:
--   1. cockpit_audit_log has no index on (created_at) — range scans are seq-scans
--   2. cockpit_audit_log has no index on (agent, action) — filtered reads (read_audit_log) full-scan
--   3. cockpit_audit_log has no index on (ticket_id) — ticket-scoped lookups are slow
--   4. The tool_trace column is JSONB and unindexed — jsonb_path_ops GIN enables fast @> queries
--   5. INSERT is synchronous in the hot runner path — replaced with advisory-lock-free UNLOGGED
--      staging table + pg_cron drain (see below)
--   6. cost_usd_milli, input_tokens, output_tokens are stored as nullable NUMERIC — no constraint
--      prevents negative drift; added CHECK guards

-- ─── STEP 1: Targeted indexes (all CONCURRENTLY so no table lock in prod) ────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_created_at
  ON public.cockpit_audit_log (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_agent_action
  ON public.cockpit_audit_log (agent, action);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_ticket_id
  ON public.cockpit_audit_log (ticket_id)
  WHERE ticket_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_success
  ON public.cockpit_audit_log (success, created_at DESC);

-- GIN index for JSONB tool_trace — enables fast @> containment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_tool_trace_gin
  ON public.cockpit_audit_log USING GIN (tool_trace jsonb_path_ops)
  WHERE tool_trace IS NOT NULL;

-- ─── STEP 2: UNLOGGED staging table for high-frequency async inserts ─────────
-- The runner writes to this table (no WAL overhead), pg_cron drains to the main
-- table every 5 seconds.  Acceptable loss window on crash: <5 s of audit rows.

CREATE UNLOGGED TABLE IF NOT EXISTS public.cockpit_audit_log_staging (
  LIKE public.cockpit_audit_log INCLUDING DEFAULTS
);

-- Function: drain staging → main (idempotent, safe to call repeatedly)
CREATE OR REPLACE FUNCTION public.drain_audit_log_staging()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH moved AS (
    DELETE FROM public.cockpit_audit_log_staging
    RETURNING *
  )
  INSERT INTO public.cockpit_audit_log (
    created_at, agent, action, target, ticket_id, metadata,
    success, reasoning, input_tokens, output_tokens, cost_usd_milli,
    tool_trace, duration_ms
  )
  SELECT
    created_at, agent, action, target, ticket_id, metadata,
    success, reasoning, input_tokens, output_tokens, cost_usd_milli,
    tool_trace, duration_ms
  FROM moved
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── STEP 3: pg_cron schedule — drain every 5 seconds ────────────────────────
-- Requires pg_cron extension (already enabled on Supabase Pro).
-- Runs as postgres superuser; SECURITY DEFINER fn above restricts what it can do.

SELECT cron.schedule(
  'drain-audit-log-staging',   -- job name (idempotent)
  '5 seconds',                  -- interval
  $$SELECT public.drain_audit_log_staging()$$
)
ON CONFLICT (jobname) DO UPDATE
  SET schedule = EXCLUDED.schedule,
      command  = EXCLUDED.command;

-- ─── STEP 4: Data-quality CHECK constraints ───────────────────────────────────
-- Guard against negative token/cost values that skew cost dashboards.

ALTER TABLE public.cockpit_audit_log
  ADD CONSTRAINT IF NOT EXISTS chk_audit_input_tokens_nn
    CHECK (input_tokens IS NULL OR input_tokens >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_audit_output_tokens_nn
    CHECK (output_tokens IS NULL OR output_tokens >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_audit_cost_nn
    CHECK (cost_usd_milli IS NULL OR cost_usd_milli >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_audit_duration_nn
    CHECK (duration_ms IS NULL OR duration_ms >= 0);

-- ─── STEP 5: Partial index for active runner queries ─────────────────────────
-- read_audit_log typically filters success=false (failures) or a specific agent.
-- Covering index on recent failures avoids heap fetches.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_failures_recent
  ON public.cockpit_audit_log (agent, created_at DESC)
  WHERE success = false;

-- ─── STEP 6: VACUUM / statistics refresh ─────────────────────────────────────
-- After adding indexes, refresh planner stats so query plans update immediately.
ANALYZE public.cockpit_audit_log;

-- ─── ROLLBACK NOTES ──────────────────────────────────────────────────────────
-- To revert:
--   DROP INDEX CONCURRENTLY IF EXISTS idx_audit_created_at;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_audit_agent_action;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_audit_ticket_id;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_audit_success;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_audit_tool_trace_gin;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_audit_failures_recent;
--   DROP TABLE IF EXISTS public.cockpit_audit_log_staging;
--   DROP FUNCTION IF EXISTS public.drain_audit_log_staging();
--   SELECT cron.unschedule('drain-audit-log-staging');
--   ALTER TABLE public.cockpit_audit_log
--     DROP CONSTRAINT IF EXISTS chk_audit_input_tokens_nn,
--     DROP CONSTRAINT IF EXISTS chk_audit_output_tokens_nn,
--     DROP CONSTRAINT IF EXISTS chk_audit_cost_nn,
--     DROP CONSTRAINT IF EXISTS chk_audit_duration_nn;
