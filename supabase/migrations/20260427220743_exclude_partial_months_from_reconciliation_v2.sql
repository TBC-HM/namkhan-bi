-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427220743
-- Name:    exclude_partial_months_from_reconciliation_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP VIEW IF EXISTS gl.v_cb_qb_reconciliation_vat_adj CASCADE;

CREATE VIEW gl.v_cb_qb_reconciliation_vat_adj AS
WITH cb_monthly AS (
  SELECT 
    EXTRACT(YEAR FROM metric_date)::int AS period_year,
    EXTRACT(MONTH FROM metric_date)::int AS period_month,
    SUM(rooms_revenue) AS cb_gross_usd
  FROM public.daily_metrics
  WHERE rooms_revenue > 0 AND is_actual = true
  GROUP BY 1, 2
),
qb_monthly AS (
  SELECT 
    period_year, period_month,
    SUM(amount_usd) AS qb_net_usd,
    bool_or(is_partial_month) AS is_partial,
    MAX(partial_month_end_day) AS partial_day
  FROM gl.pnl_snapshot
  WHERE account_code = '708010'
  GROUP BY 1, 2
)
SELECT 
  COALESCE(cb.period_year, qb.period_year) AS period_year,
  COALESCE(cb.period_month, qb.period_month) AS period_month,
  cb.cb_gross_usd,
  ROUND(cb.cb_gross_usd / 1.21, 2) AS cb_net_implied_usd,
  qb.qb_net_usd,
  ROUND((cb.cb_gross_usd / 1.21) - qb.qb_net_usd, 2) AS adjusted_gap_usd,
  ROUND(((cb.cb_gross_usd / 1.21) - qb.qb_net_usd) / NULLIF(qb.qb_net_usd, 0) * 100, 2) AS adjusted_gap_pct,
  COALESCE(qb.is_partial, false) AS qb_is_partial,
  qb.partial_day,
  CASE 
    WHEN COALESCE(qb.is_partial, false) THEN 'PARTIAL_PERIOD'
    WHEN qb.qb_net_usd IS NULL THEN 'QB_MISSING'
    WHEN cb.cb_gross_usd IS NULL THEN 'CB_MISSING'
    WHEN ABS(((cb.cb_gross_usd / 1.21) - qb.qb_net_usd) / NULLIF(qb.qb_net_usd, 0)) <= 0.05 THEN 'RECONCILED'
    WHEN ABS(((cb.cb_gross_usd / 1.21) - qb.qb_net_usd) / NULLIF(qb.qb_net_usd, 0)) <= 0.15 THEN 'MINOR_GAP'
    ELSE 'INVESTIGATE'
  END AS reconciliation_status
FROM cb_monthly cb
FULL OUTER JOIN qb_monthly qb USING (period_year, period_month)
ORDER BY period_year, period_month;