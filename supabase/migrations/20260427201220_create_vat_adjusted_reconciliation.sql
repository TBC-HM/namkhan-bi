-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427201220
-- Name:    create_vat_adjusted_reconciliation
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- VAT-adjusted reconciliation
-- Lao VAT 10%, Service charge 10% on rooms (compounded: ~21%)
-- Cloudbeds books gross (with VAT+SC), QB books net of these
-- Hypothesis: Cloudbeds_revenue / 1.21 ≈ QB_revenue
CREATE OR REPLACE VIEW gl.v_cb_qb_reconciliation_vat_adj AS
WITH 
  cb_rooms AS (
    SELECT 
      EXTRACT(YEAR FROM metric_date)::int AS period_year,
      EXTRACT(MONTH FROM metric_date)::int AS period_month,
      SUM(rooms_revenue) AS cb_gross_usd
    FROM public.daily_metrics
    WHERE rooms_revenue > 0 AND is_actual = true
    GROUP BY 1, 2
  ),
  qb_rooms AS (
    SELECT 
      period_year,
      period_month,
      SUM(amount_usd) AS qb_net_usd
    FROM gl.pnl_snapshot
    WHERE account_code = '708010'
    GROUP BY 1, 2
  )
SELECT 
  COALESCE(cb.period_year, qb.period_year) AS period_year,
  COALESCE(cb.period_month, qb.period_month) AS period_month,
  ROUND(COALESCE(cb.cb_gross_usd, 0), 2) AS cb_gross_usd,
  ROUND(COALESCE(cb.cb_gross_usd, 0) / 1.21, 2) AS cb_net_implied_usd,
  ROUND(COALESCE(qb.qb_net_usd, 0), 2) AS qb_net_usd,
  ROUND(COALESCE(cb.cb_gross_usd, 0) / 1.21 - COALESCE(qb.qb_net_usd, 0), 2) AS adjusted_gap_usd,
  CASE 
    WHEN COALESCE(qb.qb_net_usd, 0) = 0 THEN NULL
    ELSE ROUND((COALESCE(cb.cb_gross_usd, 0) / 1.21 - qb.qb_net_usd) / qb.qb_net_usd * 100, 2)
  END AS adjusted_gap_pct,
  CASE 
    WHEN COALESCE(cb.cb_gross_usd, 0) = 0 OR COALESCE(qb.qb_net_usd, 0) = 0 THEN 'INCOMPLETE'
    WHEN ABS(COALESCE(cb.cb_gross_usd, 0)/1.21 - qb.qb_net_usd) / GREATEST(qb.qb_net_usd, 1) > 0.10 THEN 'INVESTIGATE'
    WHEN ABS(COALESCE(cb.cb_gross_usd, 0)/1.21 - qb.qb_net_usd) / GREATEST(qb.qb_net_usd, 1) > 0.03 THEN 'MINOR_GAP'
    ELSE 'RECONCILED'
  END AS reconciliation_status
FROM cb_rooms cb
FULL OUTER JOIN qb_rooms qb 
  ON cb.period_year = qb.period_year AND cb.period_month = qb.period_month
WHERE COALESCE(cb.cb_gross_usd, 0) > 0 OR COALESCE(qb.qb_net_usd, 0) > 0
ORDER BY period_year DESC, period_month DESC;