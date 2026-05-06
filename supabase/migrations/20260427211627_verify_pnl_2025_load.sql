-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427211627
-- Name:    verify_pnl_2025_load
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Build a verification view
CREATE OR REPLACE VIEW gl.v_pnl_load_verification AS
SELECT 
  period_year, 
  COUNT(*) AS row_count,
  COUNT(DISTINCT account_code) AS distinct_accounts,
  COUNT(DISTINCT period_month) AS months_loaded,
  ROUND(SUM(amount_usd), 2) AS sum_usd,
  MIN(period_month) AS first_month,
  MAX(period_month) AS last_month
FROM gl.pnl_snapshot
GROUP BY period_year
ORDER BY period_year;