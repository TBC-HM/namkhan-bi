-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171743
-- Name:    phase1_18_flow_through
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_18_flow_through.sql
-- Gap 7 — Flow-through computation. Depends on phase1_13 (gl.v_pnl_usali).
-- Note: kpi.metric() returns scalar numeric in this project.

CREATE OR REPLACE FUNCTION kpi.flow_through(
  p_from date, p_to date, p_lag_days int DEFAULT 365
) RETURNS TABLE(rev_delta numeric, gop_delta numeric, flow_through_pct numeric)
LANGUAGE sql STABLE AS $$
  WITH cur AS (
    SELECT
      kpi.metric('total_revenue', p_from, p_to) AS rev,
      kpi.metric('total_revenue', p_from, p_to)
        - COALESCE((
            SELECT SUM(amount) FROM gl.v_pnl_usali
            WHERE posting_date BETWEEN p_from AND p_to
              AND usali_section IN ('dept_expense','undistributed')
          ), 0) AS gop
  ),
  pri AS (
    SELECT
      kpi.metric('total_revenue', p_from - p_lag_days, p_to - p_lag_days) AS rev,
      kpi.metric('total_revenue', p_from - p_lag_days, p_to - p_lag_days)
        - COALESCE((
            SELECT SUM(amount) FROM gl.v_pnl_usali
            WHERE posting_date BETWEEN p_from - p_lag_days AND p_to - p_lag_days
              AND usali_section IN ('dept_expense','undistributed')
          ), 0) AS gop
  )
  SELECT (cur.rev - pri.rev),
         (cur.gop - pri.gop),
         100.0 * (cur.gop - pri.gop) / NULLIF(cur.rev - pri.rev, 0)
  FROM cur, pri;
$$;

COMMENT ON FUNCTION kpi.flow_through(date,date,int) IS 'Phase1_18 — Gap 7: flow-through %. Depends on gl.v_pnl_usali (Gap 2).';

-- DOWN:
-- DROP FUNCTION IF EXISTS kpi.flow_through(date,date,int);