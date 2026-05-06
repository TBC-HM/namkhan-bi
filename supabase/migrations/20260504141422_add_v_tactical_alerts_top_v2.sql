-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504141422
-- Name:    add_v_tactical_alerts_top_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW public.v_tactical_alerts_top AS
WITH dq_rows AS (
  SELECT
    'dq:'::text || violation_id::text AS alert_id,
    'DQ' AS source,
    severity,
    rule_name AS title,
    rule_name || ' — ' || entity_type || ' ' || entity_id AS description,
    entity_type AS dim_label,
    entity_id AS dim_value,
    detected_at,
    hours_open
  FROM dq.v_alerts_active
  WHERE severity IN ('CRITICAL','WARNING')
),
gl_rows AS (
  SELECT
    'gl_sup:' || account_id AS alert_id,
    'GL' AS source,
    'WARNING' AS severity,
    'Supplier account anomaly · ' || account_name AS title,
    vendor_name || ' — share of spend ' || ROUND(COALESCE(share_of_vendor_spend, 0) * 100)::text || '%' AS description,
    'vendor' AS dim_label,
    vendor_name AS dim_value,
    now() - INTERVAL '1 hour' AS detected_at,
    1::numeric AS hours_open
  FROM gl.v_supplier_account_anomalies
  ORDER BY share_of_vendor_spend DESC NULLS LAST
  LIMIT 6
),
staff_rows AS (
  SELECT
    'staff:' || staff_id::text AS alert_id,
    'Staff' AS source,
    'WARNING' AS severity,
    'Staff anomaly · ' || COALESCE(issue, 'unspecified') AS title,
    full_name || ' — ' || COALESCE(dept_name, 'unknown dept') AS description,
    'department' AS dim_label,
    COALESCE(dept_name, dept_code, '—') AS dim_value,
    now() - INTERVAL '12 hours' AS detected_at,
    12::numeric AS hours_open
  FROM ops.v_staff_anomalies
  LIMIT 4
),
compset_rows AS (
  SELECT
    'compset_promo:' || comp_id::text AS alert_id,
    'CompSet' AS source,
    CASE WHEN promo_frequency_pct >= 50 THEN 'CRITICAL'
         WHEN promo_frequency_pct >= 25 THEN 'WARNING'
         ELSE 'INFO' END AS severity,
    'Competitor promo activity · ' || pattern_label AS title,
    property_name || ' — promo frequency ' || ROUND(COALESCE(promo_frequency_pct, 0))::text || '% · max discount '
      || ROUND(COALESCE(max_discount_seen, 0))::text || '%' AS description,
    'competitor' AS dim_label,
    property_name AS dim_value,
    now() - INTERVAL '6 hours' AS detected_at,
    6::numeric AS hours_open
  FROM public.v_compset_promo_behavior_signals
  WHERE NOT is_self
    AND pattern <> 'no_data'
    AND promo_frequency_pct >= 15
)
SELECT
  alert_id, source, severity, title, description, dim_label, dim_value,
  detected_at, hours_open,
  CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 WHEN 'INFO' THEN 3 ELSE 4 END AS sev_rank
FROM (
  SELECT * FROM dq_rows
  UNION ALL SELECT * FROM gl_rows
  UNION ALL SELECT * FROM staff_rows
  UNION ALL SELECT * FROM compset_rows
) u
ORDER BY sev_rank, detected_at DESC
LIMIT 8;
GRANT SELECT ON public.v_tactical_alerts_top TO anon, authenticated, service_role;