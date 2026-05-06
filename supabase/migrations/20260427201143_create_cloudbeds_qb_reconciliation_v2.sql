-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427201143
-- Name:    create_cloudbeds_qb_reconciliation_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW gl.v_cb_qb_reconciliation AS
WITH 
  cb_rooms AS (
    SELECT 
      EXTRACT(YEAR FROM metric_date)::int AS period_year,
      EXTRACT(MONTH FROM metric_date)::int AS period_month,
      'Rooms' AS dept,
      SUM(rooms_revenue) AS amount_usd
    FROM public.daily_metrics
    WHERE rooms_revenue > 0 AND is_actual = true
    GROUP BY 1, 2
  ),
  qb_rooms AS (
    SELECT 
      period_year,
      period_month,
      'Rooms' AS dept,
      SUM(amount_usd) AS amount_usd
    FROM gl.pnl_snapshot
    WHERE account_code = '708010'
    GROUP BY 1, 2
  ),
  cb_total AS (
    SELECT 
      EXTRACT(YEAR FROM metric_date)::int AS period_year,
      EXTRACT(MONTH FROM metric_date)::int AS period_month,
      'Total' AS dept,
      SUM(total_revenue) AS amount_usd
    FROM public.daily_metrics
    WHERE total_revenue > 0 AND is_actual = true
    GROUP BY 1, 2
  ),
  qb_total AS (
    SELECT 
      ps.period_year,
      ps.period_month,
      'Total' AS dept,
      SUM(ps.amount_usd) AS amount_usd
    FROM gl.pnl_snapshot ps
    JOIN gl.accounts a ON a.account_code = ps.account_code
    WHERE a.account_class = 'Revenue'
    GROUP BY 1, 2
  ),
  combined AS (
    SELECT COALESCE(cb.period_year, qb.period_year) AS period_year, 
           COALESCE(cb.period_month, qb.period_month) AS period_month, 
           'Rooms' AS dept, 
           cb.amount_usd AS cloudbeds_usd, 
           qb.amount_usd AS qb_usd
    FROM cb_rooms cb
    FULL OUTER JOIN qb_rooms qb 
      ON cb.period_year = qb.period_year AND cb.period_month = qb.period_month
    UNION ALL
    SELECT COALESCE(cb.period_year, qb.period_year), 
           COALESCE(cb.period_month, qb.period_month), 
           'Total', 
           cb.amount_usd, 
           qb.amount_usd
    FROM cb_total cb
    FULL OUTER JOIN qb_total qb 
      ON cb.period_year = qb.period_year AND cb.period_month = qb.period_month
  )
SELECT 
  period_year,
  period_month,
  dept,
  ROUND(COALESCE(cloudbeds_usd, 0), 2) AS cloudbeds_usd,
  ROUND(COALESCE(qb_usd, 0), 2) AS qb_usd,
  ROUND(COALESCE(cloudbeds_usd, 0) - COALESCE(qb_usd, 0), 2) AS gap_usd,
  CASE 
    WHEN COALESCE(qb_usd, 0) = 0 THEN NULL
    ELSE ROUND((COALESCE(cloudbeds_usd, 0) - COALESCE(qb_usd, 0)) / qb_usd * 100, 2)
  END AS gap_pct,
  CASE 
    WHEN COALESCE(cloudbeds_usd, 0) = 0 OR COALESCE(qb_usd, 0) = 0 THEN 'CRITICAL'
    WHEN ABS(COALESCE(cloudbeds_usd, 0) - COALESCE(qb_usd, 0)) / GREATEST(qb_usd, 1) > 0.30 THEN 'CRITICAL'
    WHEN ABS(COALESCE(cloudbeds_usd, 0) - COALESCE(qb_usd, 0)) / GREATEST(qb_usd, 1) > 0.15 THEN 'WARNING'
    WHEN ABS(COALESCE(cloudbeds_usd, 0) - COALESCE(qb_usd, 0)) / GREATEST(qb_usd, 1) > 0.05 THEN 'INFO'
    ELSE 'OK'
  END AS severity
FROM combined
WHERE COALESCE(cloudbeds_usd, 0) > 0 OR COALESCE(qb_usd, 0) > 0
ORDER BY period_year DESC, period_month DESC, dept;