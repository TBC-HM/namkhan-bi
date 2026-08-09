-- scripts/kpi-conformance/battery-ratios.sql
-- Harness: kpi-conformance-battery/ratios-v1
-- Brief:   kpi-conformance-slice-battery-ratios
-- Scope:   The Namkhan (property_id 260955) ratio-family KPI conformance probe.
-- Safe to re-run. Read-only against kpi/public/pms views; single INSERT into
-- governance.module_test_runs per execution. No DDL. Never fabricate a row:
-- this script computes every check live and records exactly what it saw.
--
-- Checks (14):
--   cancel_rate_numerator            view definition restricts cancellations to status_canonical='canceled'
--   opex_slope_scaled                slope per occupancy POINT, magnitude 100..10000
--   opex_bridge_concordance          public.v_corr_cost_occupancy_12mo == kpi source
--   ancillary_no_collapse            no row with a positive component but ancillary total 0
--   labour_currency_computed         currency_mismatch is a computed SELECT column and view returns rows
--   cpor_latest_value                kpi.v_cpor_monthly returns rows; latest value recorded
--   fnb_corr_restricted              F&B correlation source restricted to usali_dept='F&B'
--   fnb_bridge_concordance           public.v_corr_fnb_rooms_12mo == kpi source
--   season_index_data                public.v_seasonal_index returns rows
--   booking_window_reconciliation    bucketed reservation count == source non-voided reservations
--   deposit_three_view_concordance   KPI 114 == 115 == 235 on count / committed / held in one run
--   bridge_opex_accessible           authenticated SELECT privilege on public bridge
--   bridge_fnb_accessible            authenticated SELECT privilege on public bridge
--   bridge_booking_window_accessible authenticated SELECT privilege on public bridge (+ row count)
--
-- NOTE (2026-08-09): brief item 9 originally demanded anon SELECT. ADR-277
-- (anon lockdown, claude_md v112 L5) revoked ALL anon grants on public —
-- bridges are now authenticated/service_role only, never anon. Reachability
-- is therefore proved against 'authenticated', matching the current law.

WITH
cancel_def AS (SELECT pg_get_viewdef('kpi.v_cancel_rate_by_channel_monthly'::regclass) AS d),
cancel_data AS (SELECT count(*) AS n FROM kpi.v_cancel_rate_by_channel_monthly WHERE property_id = 260955),
opex_k AS (SELECT slope_opex_per_occ_pt AS s, corr_opex_occ AS c, r2 FROM kpi.v_corr_cost_occupancy_12mo WHERE property_id = 260955),
opex_p AS (SELECT slope_opex_per_occ_pt AS s, corr_opex_occ AS c, r2 FROM public.v_corr_cost_occupancy_12mo WHERE property_id = 260955),
anc AS (
  SELECT count(*) AS bad
  FROM public.v_reservation_ancillary
  WHERE property_id = 260955
    AND (COALESCE(fb_rev,0) > 0 OR COALESCE(other_op_rev,0) > 0 OR COALESCE(retail_rev,0) > 0 OR COALESCE(misc_rev,0) > 0)
    AND COALESCE(ancillary_rev,0) = 0
),
lab_def AS (SELECT pg_get_viewdef('kpi.v_labour_cost_ratio_monthly'::regclass) AS d),
lab_rows AS (SELECT count(*) AS n FROM kpi.v_labour_cost_ratio_monthly WHERE property_id = 260955),
cpor AS (SELECT period_month, cpor FROM kpi.v_cpor_monthly WHERE property_id = 260955 ORDER BY period_month DESC LIMIT 1),
cpor_n AS (SELECT count(*) AS n FROM kpi.v_cpor_monthly WHERE property_id = 260955),
fnb_def AS (SELECT pg_get_viewdef('kpi.v_corr_fnb_rooms_12mo'::regclass) AS d),
fnb_k AS (SELECT corr_fnb_rooms AS c, fnb_capture_rate AS f, r2 FROM kpi.v_corr_fnb_rooms_12mo WHERE property_id = 260955),
fnb_p AS (SELECT corr_fnb_rooms AS c, fnb_capture_rate AS f, r2 FROM public.v_corr_fnb_rooms_12mo WHERE property_id = 260955),
season AS (SELECT count(*) AS n FROM public.v_seasonal_index WHERE property_id = 260955),
bw_view AS (SELECT COALESCE(sum(total_reservations),0) AS n FROM kpi.v_chart_booking_window_distribution WHERE property_id = 260955),
bw_src AS (SELECT count(*) AS n FROM pms.v_reservations WHERE property_id = 260955 AND is_voided = false AND check_in_date IS NOT NULL),
dep114 AS (SELECT COALESCE(sum(future_reservations),0)::int AS r, round(COALESCE(sum(total_committed),0),2) AS c, round(COALESCE(sum(deposits_held),0),2) AS h FROM kpi.v_deposit_pipeline_by_arrival_month WHERE property_id = 260955),
dep115 AS (SELECT future_reservations::int AS r, round(total_committed,2) AS c, round(deposits_held,2) AS h FROM kpi.v_deposit_pipeline_summary WHERE property_id = 260955),
dep235 AS (SELECT COALESCE(sum(future_reservations),0)::int AS r, round(COALESCE(sum(total_committed),0),2) AS c, round(COALESCE(sum(deposits_held),0),2) AS h FROM kpi.v_deposit_coverage_monthly WHERE property_id = 260955),
bwp AS (SELECT count(*) AS n FROM public.v_chart_booking_window_distribution_from WHERE property_id = 260955),
raw AS (
  SELECT 'cancel_rate_numerator' AS chk,
         'cancellations column counts only status_canonical=canceled' AS expected,
         CASE WHEN (SELECT d FROM cancel_def) LIKE '%status_canonical = ''canceled''%' AND (SELECT n FROM cancel_data) > 0
              THEN 'PASS: definition restricted, ' || (SELECT n FROM cancel_data) || ' rows' ELSE 'FAIL: definition or data' END AS actual,
         ((SELECT d FROM cancel_def) LIKE '%status_canonical = ''canceled''%' AND (SELECT n FROM cancel_data) > 0) AS ok
  UNION ALL
  SELECT 'opex_slope_scaled', 'slope in hundreds to low thousands',
         'slope = ' || COALESCE((SELECT s FROM opex_k)::text, 'NULL'),
         (SELECT abs(s) BETWEEN 100 AND 10000 FROM opex_k)
  UNION ALL
  SELECT 'opex_bridge_concordance', 'public matches kpi',
         'slope=' || COALESCE((SELECT s FROM opex_p)::text,'NULL') || ', corr=' || COALESCE((SELECT c FROM opex_p)::text,'NULL') || ', r2=' || COALESCE((SELECT r2 FROM opex_p)::text,'NULL'),
         (SELECT k.s = p.s AND k.c = p.c AND k.r2 = p.r2 FROM opex_k k, opex_p p)
  UNION ALL
  SELECT 'ancillary_no_collapse', 'zero collapse rows',
         CASE WHEN (SELECT bad FROM anc) = 0 THEN 'no collapse' ELSE (SELECT bad FROM anc) || ' collapsed rows' END,
         ((SELECT bad FROM anc) = 0)
  UNION ALL
  SELECT 'labour_currency_computed', 'column exists',
         (SELECT n FROM lab_rows) || ' rows',
         ((SELECT d FROM lab_def) LIKE '%AS currency_mismatch%' AND (SELECT n FROM lab_rows) > 0)
  UNION ALL
  SELECT 'cpor_latest_value', 'data exists',
         'CPOR=' || COALESCE((SELECT cpor FROM cpor)::text,'NULL') || ' for ' || COALESCE((SELECT period_month FROM cpor)::text,'NULL'),
         ((SELECT n FROM cpor_n) > 0 AND (SELECT cpor FROM cpor) IS NOT NULL)
  UNION ALL
  SELECT 'fnb_corr_restricted', 'F&B dept only',
         'corr=' || COALESCE((SELECT c FROM fnb_k)::text,'NULL'),
         ((SELECT d FROM fnb_def) LIKE '%usali_dept = ''F&B''%' AND (SELECT c FROM fnb_k) IS NOT NULL)
  UNION ALL
  SELECT 'fnb_bridge_concordance', 'public matches kpi',
         'corr=' || COALESCE((SELECT c FROM fnb_p)::text,'NULL') || ', capture=' || COALESCE((SELECT f FROM fnb_p)::text,'NULL') || ', r2=' || COALESCE((SELECT r2 FROM fnb_p)::text,'NULL'),
         (SELECT k.c = p.c AND k.f = p.f AND k.r2 = p.r2 FROM fnb_k k, fnb_p p)
  UNION ALL
  SELECT 'season_index_data', 'returns rows',
         (SELECT n FROM season) || ' rows',
         ((SELECT n FROM season) > 0)
  UNION ALL
  SELECT 'booking_window_reconciliation', 'bucketed count',
         (SELECT n FROM bw_view) || ' reservations',
         ((SELECT n FROM bw_view) = (SELECT n FROM bw_src) AND (SELECT n FROM bw_view) > 0)
  UNION ALL
  SELECT 'deposit_three_view_concordance', 'KPI 114=115=235',
         'res=' || (SELECT r FROM dep114) || ', comm=' || (SELECT c FROM dep114) || ', held=' || (SELECT h FROM dep114),
         (SELECT a.r = b.r AND a.r = c3.r AND a.c = b.c AND a.c = c3.c AND a.h = b.h AND a.h = c3.h
            FROM dep114 a, dep115 b, dep235 c3)
  UNION ALL
  SELECT 'bridge_opex_accessible', 'authenticated can SELECT (ADR-277)',
         CASE WHEN has_table_privilege('authenticated','public.v_corr_cost_occupancy_12mo','SELECT') THEN 'accessible' ELSE 'NO GRANT' END,
         has_table_privilege('authenticated','public.v_corr_cost_occupancy_12mo','SELECT')
  UNION ALL
  SELECT 'bridge_fnb_accessible', 'authenticated can SELECT (ADR-277)',
         CASE WHEN has_table_privilege('authenticated','public.v_corr_fnb_rooms_12mo','SELECT') THEN 'accessible' ELSE 'NO GRANT' END,
         has_table_privilege('authenticated','public.v_corr_fnb_rooms_12mo','SELECT')
  UNION ALL
  SELECT 'bridge_booking_window_accessible', 'authenticated can SELECT (ADR-277)',
         (SELECT n FROM bwp) || ' rows',
         (has_table_privilege('authenticated','public.v_chart_booking_window_distribution_from','SELECT') AND (SELECT n FROM bwp) > 0)
),
agg AS (
  SELECT jsonb_agg(jsonb_build_object('check', chk, 'expected', expected, 'actual', actual, 'ok', COALESCE(ok,false)) ORDER BY chk) AS j,
         bool_and(COALESCE(ok,false)) AS all_ok
  FROM raw
)
INSERT INTO governance.module_test_runs (module_doc_type, ok, checks, harness_version, run_by)
SELECT 'kpi_conformance', all_ok, j, 'kpi-conformance-battery/ratios-v1', 'battery-ratios.sql'
FROM agg
RETURNING id, ok, run_at;
