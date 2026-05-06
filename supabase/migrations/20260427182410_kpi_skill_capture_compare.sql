-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427182410
-- Name:    kpi_skill_capture_compare
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- SKILL: kpi.capture_rate_compare(date_from, date_to, lag)
-- Compare current period vs same period N days ago
-- lag = 7  → last 7d vs prior 7d
-- lag = 30 → last 30d vs prior 30d
-- lag = 365 → SDLY (same period last year)
-- ============================================================

CREATE OR REPLACE FUNCTION kpi.capture_rate_compare(
  p_from date DEFAULT (CURRENT_DATE - 30),
  p_to date DEFAULT (CURRENT_DATE - 1),
  p_lag_days int DEFAULT 365
)
RETURNS TABLE(
  usali_dept text,
  usali_subdept text,
  cur_res int,
  cur_capture_pct numeric,
  cur_revenue numeric,
  cur_spend_per_room numeric,
  prev_res int,
  prev_capture_pct numeric,
  prev_revenue numeric,
  prev_spend_per_room numeric,
  rev_delta_pct numeric,
  capture_delta_pp numeric
) AS $$
DECLARE
  prev_from date := p_from - p_lag_days;
  prev_to   date := p_to   - p_lag_days;
BEGIN
  RETURN QUERY
  WITH cur AS (SELECT * FROM kpi.capture_rate(p_from, p_to, 'overall')),
       prev AS (SELECT * FROM kpi.capture_rate(prev_from, prev_to, 'overall'))
  SELECT 
    COALESCE(c.usali_dept, p.usali_dept),
    COALESCE(c.usali_subdept, p.usali_subdept),
    COALESCE(c.reservations_in_house, 0),
    COALESCE(c.capture_rate_pct, 0),
    COALESCE(c.revenue, 0),
    COALESCE(c.spend_per_occ_room, 0),
    COALESCE(p.reservations_in_house, 0),
    COALESCE(p.capture_rate_pct, 0),
    COALESCE(p.revenue, 0),
    COALESCE(p.spend_per_occ_room, 0),
    ROUND(100.0 * (COALESCE(c.revenue,0) - COALESCE(p.revenue,0)) 
          / NULLIF(COALESCE(p.revenue,0)::numeric, 0), 1),
    ROUND((COALESCE(c.capture_rate_pct,0) - COALESCE(p.capture_rate_pct,0))::numeric, 1)
  FROM cur c
  FULL OUTER JOIN prev p 
    ON c.usali_dept = p.usali_dept 
   AND COALESCE(c.usali_subdept,'') = COALESCE(p.usali_subdept,'')
  ORDER BY COALESCE(c.revenue, 0) DESC;
END;
$$ LANGUAGE plpgsql STABLE;
