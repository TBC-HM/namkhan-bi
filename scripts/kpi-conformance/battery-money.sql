-- =====================================================================
-- KPI CONFORMANCE BATTERY — MONEY FAMILY (property 260955, The Namkhan)
-- harness_version: kpi-conformance-battery/money-v2
-- Brief: kpi-conformance-slice-battery-money
--
-- v1 → v2 (2026-08-09): bridge check inverted per ADR-277 anon lockdown.
--   v1 asserted the three public bridges were anon-SELECTable. ADR-277
--   (security remediation SEC-001, human-approved) revoked ALL anon
--   grants in public; claude_md L5 v112 mandates bridges GRANT to
--   authenticated/service_role ONLY, never anon. v2 therefore asserts:
--   authenticated=TRUE AND service_role=TRUE AND anon=FALSE.
--
-- Probe-only: reads 10 repaired views + silver pms.v_transactions.
-- Zero DDL. One INSERT into governance.module_test_runs per execution.
-- Idempotent and safe to re-run at any time (each run appends one row
-- with genuinely measured values — never fabricate rows).
-- =====================================================================

INSERT INTO governance.module_test_runs (module_doc_type, ok, checks, harness_version, run_by)
SELECT
  'kpi_conformance',
  (SELECT bool_and((c->>'ok')::boolean) FROM jsonb_array_elements(checks.arr) c),
  checks.arr,
  'kpi-conformance-battery/money-v2',
  coalesce(current_setting('app.worker_id', true), 'battery-money-script')
FROM (
  WITH ar AS (
    SELECT round((SELECT coalesce(sum(total_outstanding),0)   FROM kpi.v_ar_aging_buckets      WHERE property_id=260955),2) AS aging,
           round((SELECT coalesce(sum(outstanding_balance),0) FROM kpi.v_ar_outstanding_detail WHERE property_id=260955),2) AS detail,
           round((SELECT coalesce(ar_outstanding,0)           FROM public.v_dso_current        WHERE property_id=260955),2) AS dso
  ), mar AS (
    SELECT count(*) AS n, round(coalesce(sum(cash_in),0),2) AS total
    FROM kpi.v_cash_flow_daily
    WHERE property_id=260955 AND tx_date >= '2026-03-01' AND tx_date < '2026-04-01'
  ), jun AS (
    SELECT round((SELECT coalesce(sum(cash_in),0)      FROM kpi.v_cash_flow_daily            WHERE property_id=260955 AND tx_date >= '2026-06-01' AND tx_date < '2026-07-01'),2) AS daily,
           round((SELECT coalesce(sum(cash_in),0)      FROM kpi.v_cash_flow_monthly          WHERE property_id=260955 AND month_start='2026-06-01'),2) AS monthly,
           round((SELECT coalesce(sum(total_amount),0) FROM kpi.v_payment_method_monthly     WHERE property_id=260955 AND month='2026-06-01'),2) AS pay_kpi,
           round((SELECT coalesce(sum(total_amount),0) FROM public.v_payment_method_monthly  WHERE property_id=260955 AND month='2026-06-01'),2) AS pay_pub
  ), comp AS (
    SELECT round((SELECT coalesce(sum(comp_discount_value),0) FROM kpi.v_tx_comp_discount    WHERE property_id=260955),2) AS kpi_total,
           (SELECT count(*) FROM kpi.v_tx_comp_discount    WHERE property_id=260955) AS kpi_rows,
           round((SELECT coalesce(sum(comp_discount_value),0) FROM public.v_tx_comp_discount WHERE property_id=260955),2) AS pub_total,
           (SELECT count(*) FROM public.v_tx_comp_discount WHERE property_id=260955) AS pub_rows
  ), voids AS (
    SELECT (SELECT coalesce(sum(adj_count),0)              FROM public.v_tx_adjustments_monitor WHERE property_id=260955 AND adjustment_type='void') AS mon_count,
           round((SELECT coalesce(sum(gross_abs_amount),0) FROM public.v_tx_adjustments_monitor WHERE property_id=260955 AND adjustment_type='void'),2) AS mon_gross,
           (SELECT count(*)                                FROM pms.v_transactions              WHERE property_id=260955 AND category='void') AS src_count,
           round((SELECT coalesce(sum(abs(amount)),0)      FROM pms.v_transactions              WHERE property_id=260955 AND category='void'),2) AS src_gross
  ), bridges AS (
    SELECT has_table_privilege('authenticated','public.v_dso_current','SELECT')
       AND has_table_privilege('authenticated','public.v_payment_method_monthly','SELECT')
       AND has_table_privilege('authenticated','public.v_tx_comp_discount','SELECT') AS b_auth,
           has_table_privilege('service_role','public.v_dso_current','SELECT')
       AND has_table_privilege('service_role','public.v_payment_method_monthly','SELECT')
       AND has_table_privilege('service_role','public.v_tx_comp_discount','SELECT') AS b_svc,
           has_table_privilege('anon','public.v_dso_current','SELECT')
        OR has_table_privilege('anon','public.v_payment_method_monthly','SELECT')
        OR has_table_privilege('anon','public.v_tx_comp_discount','SELECT') AS b_anon_leak
  )
  SELECT jsonb_build_array(
    jsonb_build_object('check','ar_three_way_match',
      'expected', format('aging=%s, detail=%s, dso=%s', ar.aging, ar.detail, ar.dso),
      'actual',   CASE WHEN ar.aging=ar.detail AND ar.detail=ar.dso
                       THEN format('all three match: %s', ar.dso)
                       ELSE format('MISMATCH aging=%s detail=%s dso=%s', ar.aging, ar.detail, ar.dso) END,
      'ok', ar.aging=ar.detail AND ar.detail=ar.dso),
    jsonb_build_object('check','cash_march_2026',
      'expected','rows > 0 and total = 95436.08',
      'actual', format('rows=%s, total=%s', mar.n, mar.total),
      'ok', mar.n>0 AND mar.total=95436.08),
    jsonb_build_object('check','cash_june_concordance',
      'expected','daily=monthly=payment_kpi=payment_pub',
      'actual', format('daily=%s, monthly=%s, payment_kpi=%s, payment_pub=%s', jun.daily, jun.monthly, jun.pay_kpi, jun.pay_pub),
      'ok', jun.daily=jun.monthly AND jun.monthly=jun.pay_kpi AND jun.pay_kpi=jun.pay_pub),
    jsonb_build_object('check','comp_bridge_match',
      'expected', format('kpi=%s (%s rows), pub=%s (%s rows)', comp.kpi_total, comp.kpi_rows, comp.pub_total, comp.pub_rows),
      'actual',   CASE WHEN comp.kpi_total=comp.pub_total AND comp.kpi_rows=comp.pub_rows
                       THEN format('match: %s', comp.kpi_total) ELSE 'MISMATCH' END,
      'ok', comp.kpi_total=comp.pub_total AND comp.kpi_rows=comp.pub_rows),
    jsonb_build_object('check','voids_monitor_vs_source',
      'expected', format('monitor_count=%s, monitor_gross=%s', voids.mon_count, voids.mon_gross),
      'actual',   format('source_count=%s, source_gross=%s', voids.src_count, voids.src_gross),
      'ok', voids.mon_count=voids.src_count AND voids.mon_gross=voids.src_gross),
    jsonb_build_object('check','bridge_grants_adr277',
      'expected','authenticated=t, service_role=t, anon=f (ADR-277 lockdown)',
      'actual', format('authenticated=%s, service_role=%s, anon_leak=%s', bridges.b_auth, bridges.b_svc, bridges.b_anon_leak),
      'ok', bridges.b_auth AND bridges.b_svc AND NOT bridges.b_anon_leak)
  ) AS arr
  FROM ar, mar, jun, comp, voids, bridges
) checks
RETURNING id, run_at, ok, harness_version;
