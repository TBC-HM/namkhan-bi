-- ============================================================================
-- KPI Conformance Battery: Money Family
-- ============================================================================
-- Continuously verifies the four money-family KPIs for property 260955:
--   1. AR (aging buckets, outstanding detail, DSO bridge)
--   2. Cash flow (daily, monthly, payment methods)
--   3. Comps/discounts (category integrity, bridge concordance)
--   4. Voids/adjustments (monitor vs. source concordance)
--
-- Harness: kpi-conformance-battery/money-v1
-- Safe to re-run anytime; produces a single jsonb result for logging.
-- ============================================================================

WITH 

-- ============================================================================
-- AR FAMILY CHECKS (kpi.v_ar_aging_buckets, kpi.v_ar_outstanding_detail, public.v_dso_current)
-- ============================================================================

ar_aging_total AS (
  SELECT COALESCE(SUM(total_outstanding), 0) AS total
  FROM kpi.v_ar_aging_buckets
  WHERE property_id = 260955
),

ar_detail_total AS (
  SELECT COALESCE(SUM(outstanding_balance), 0) AS total,
         COUNT(*) AS row_count
  FROM kpi.v_ar_outstanding_detail
  WHERE property_id = 260955
),

ar_dso_bridge AS (
  SELECT ar_outstanding
  FROM public.v_dso_current
  WHERE property_id = 260955
),

ar_concordance AS (
  SELECT 
    'ar_three_way_match' AS check_name,
    'aging=' || aging.total || ', detail=' || detail.total || ', dso=' || dso.ar_outstanding AS expected,
    CASE 
      WHEN aging.total = detail.total AND detail.total = dso.ar_outstanding 
      THEN 'all three match: ' || aging.total::text
      ELSE 'MISMATCH'
    END AS actual,
    (aging.total = detail.total AND detail.total = dso.ar_outstanding) AS ok
  FROM ar_aging_total aging, ar_detail_total detail, ar_dso_bridge dso
),

-- ============================================================================
-- CASH FLOW FAMILY CHECKS (kpi.v_cash_flow_daily, kpi.v_cash_flow_monthly, kpi/public.v_payment_method_monthly)
-- ============================================================================

cash_march_daily AS (
  SELECT 
    COUNT(*) AS row_count,
    COALESCE(SUM(cash_in), 0) AS total
  FROM kpi.v_cash_flow_daily
  WHERE property_id = 260955
    AND tx_date >= '2026-03-01'
    AND tx_date < '2026-04-01'
),

cash_march_check AS (
  SELECT
    'cash_march_2026' AS check_name,
    'rows > 0 and total = 95436.08' AS expected,
    'rows=' || row_count || ', total=' || total AS actual,
    (row_count > 0 AND ABS(total - 95436.08) < 0.01) AS ok
  FROM cash_march_daily
),

cash_june_daily AS (
  SELECT COALESCE(SUM(cash_in), 0) AS total
  FROM kpi.v_cash_flow_daily
  WHERE property_id = 260955
    AND tx_date >= '2026-06-01'
    AND tx_date < '2026-07-01'
),

cash_june_monthly AS (
  SELECT cash_in AS total
  FROM kpi.v_cash_flow_monthly
  WHERE property_id = 260955
    AND month_start = '2026-06-01'
),

cash_june_payment_kpi AS (
  SELECT COALESCE(SUM(total_amount), 0) AS total
  FROM kpi.v_payment_method_monthly
  WHERE property_id = 260955
    AND month = '2026-06-01'
),

cash_june_payment_pub AS (
  SELECT COALESCE(SUM(total_amount), 0) AS total
  FROM public.v_payment_method_monthly
  WHERE property_id = 260955
    AND month = '2026-06-01'
),

cash_june_concordance AS (
  SELECT
    'cash_june_concordance' AS check_name,
    'daily=monthly=payment_kpi=payment_pub' AS expected,
    'daily=' || d.total || ', monthly=' || m.total || ', payment_kpi=' || pk.total || ', payment_pub=' || pp.total AS actual,
    (d.total = m.total AND m.total = pk.total AND pk.total = pp.total) AS ok
  FROM cash_june_daily d, cash_june_monthly m, cash_june_payment_kpi pk, cash_june_payment_pub pp
),

-- ============================================================================
-- COMPS/DISCOUNTS FAMILY CHECKS (kpi.v_tx_comp_discount, public.v_tx_comp_discount)
-- ============================================================================

comp_kpi_total AS (
  SELECT 
    COALESCE(SUM(comp_discount_value), 0) AS total,
    COUNT(*) AS row_count
  FROM kpi.v_tx_comp_discount
  WHERE property_id = 260955
),

comp_pub_total AS (
  SELECT 
    COALESCE(SUM(comp_discount_value), 0) AS total,
    COUNT(*) AS row_count
  FROM public.v_tx_comp_discount
  WHERE property_id = 260955
),

comp_concordance AS (
  SELECT
    'comp_bridge_match' AS check_name,
    'kpi=' || k.total || ' (' || k.row_count || ' rows), pub=' || p.total || ' (' || p.row_count || ' rows)' AS expected,
    CASE 
      WHEN k.total = p.total AND k.row_count = p.row_count 
      THEN 'match: ' || k.total::text
      ELSE 'MISMATCH'
    END AS actual,
    (k.total = p.total AND k.row_count = p.row_count) AS ok
  FROM comp_kpi_total k, comp_pub_total p
),

-- ============================================================================
-- VOIDS/ADJUSTMENTS FAMILY CHECKS (public.v_tx_adjustments_monitor vs pms.v_transactions)
-- ============================================================================

voids_monitor AS (
  SELECT 
    COALESCE(SUM(adj_count), 0) AS void_count,
    COALESCE(SUM(gross_abs_amount), 0) AS void_gross
  FROM public.v_tx_adjustments_monitor
  WHERE property_id = 260955
    AND adjustment_type = 'void'
),

voids_source AS (
  SELECT 
    COUNT(*) AS void_count,
    COALESCE(SUM(ABS(amount)), 0) AS void_gross
  FROM pms.v_transactions
  WHERE property_id = 260955
    AND category = 'void'
),

voids_concordance AS (
  SELECT
    'voids_monitor_vs_source' AS check_name,
    'monitor_count=' || m.void_count || ', monitor_gross=' || m.void_gross AS expected,
    'source_count=' || s.void_count || ', source_gross=' || s.void_gross AS actual,
    (m.void_count = s.void_count AND ABS(m.void_gross - s.void_gross) < 0.01) AS ok
  FROM voids_monitor m, voids_source s
),

-- ============================================================================
-- BRIDGE REACHABILITY CHECKS (anon role SELECT privilege)
-- ============================================================================

bridge_privileges AS (
  SELECT
    'bridge_anon_readable' AS check_name,
    'dso, payment_method, comp all anon-SELECTable' AS expected,
    'dso=' || has_table_privilege('anon', 'public.v_dso_current', 'SELECT')::text ||
    ', payment=' || has_table_privilege('anon', 'public.v_payment_method_monthly', 'SELECT')::text ||
    ', comp=' || has_table_privilege('anon', 'public.v_tx_comp_discount', 'SELECT')::text AS actual,
    (
      has_table_privilege('anon', 'public.v_dso_current', 'SELECT') AND
      has_table_privilege('anon', 'public.v_payment_method_monthly', 'SELECT') AND
      has_table_privilege('anon', 'public.v_tx_comp_discount', 'SELECT')
    ) AS ok
),

-- ============================================================================
-- AGGREGATE ALL CHECKS
-- ============================================================================

all_checks AS (
  SELECT * FROM ar_concordance
  UNION ALL SELECT * FROM cash_march_check
  UNION ALL SELECT * FROM cash_june_concordance
  UNION ALL SELECT * FROM comp_concordance
  UNION ALL SELECT * FROM voids_concordance
  UNION ALL SELECT * FROM bridge_privileges
)

SELECT 
  jsonb_agg(
    jsonb_build_object(
      'check', check_name,
      'expected', expected,
      'actual', actual,
      'ok', ok
    ) ORDER BY check_name
  ) AS checks,
  bool_and(ok) AS all_ok
FROM all_checks;
