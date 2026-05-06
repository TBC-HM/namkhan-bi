-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504165934
-- Name:    v_tactical_alerts_top_v4_revenue_only_drop_recreate
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP VIEW IF EXISTS public.v_tactical_alerts_top;

CREATE VIEW public.v_tactical_alerts_top AS
WITH revenue_dq_rules AS (
  SELECT unnest(ARRAY['H-003', 'R-016', 'R-018']) AS rule_id
),
dq_signals AS (
  SELECT
    'dq:' || a.violation_id::text AS alert_id,
    'DQ'::text AS source,
    a.severity,
    a.rule_name AS title,
    COALESCE(a.rule_name, '') AS description,
    COALESCE(a.entity_type, '—') AS dim_label,
    COALESCE(a.entity_id, '—') AS dim_value,
    a.detected_at,
    a.hours_open,
    CASE a.severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END AS sev_rank
  FROM dq.v_alerts_active a
  JOIN revenue_dq_rules r ON r.rule_id = a.rule_id
),
compset_signals AS (
  SELECT
    'compset:' || s.comp_id::text AS alert_id,
    'CompSet'::text AS source,
    'INFO'::text AS severity,
    'Compset promo activity · ' || COALESCE(s.pattern_label, s.pattern) AS title,
    'Promo frequency ' || COALESCE(s.promo_frequency_pct::text, '—') || '% · avg discount '
      || COALESCE(s.avg_discount_pct::text, '—') || '%' AS description,
    'competitor'::text AS dim_label,
    s.property_name AS dim_value,
    now() AS detected_at,
    0::numeric AS hours_open,
    3 AS sev_rank
  FROM public.v_compset_promo_behavior_signals s
  WHERE s.is_self = false
    AND s.pattern IS NOT NULL
    AND s.pattern <> 'no_data'
    AND s.promo_frequency_pct >= 15
),
unioned AS (
  SELECT * FROM dq_signals
  UNION ALL SELECT * FROM compset_signals
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY source ORDER BY sev_rank, detected_at DESC) AS rn_in_source
  FROM unioned
)
SELECT alert_id, source, severity, title, description, dim_label, dim_value, detected_at, hours_open
FROM ranked
WHERE rn_in_source <= 4
ORDER BY sev_rank, detected_at DESC
LIMIT 8;

GRANT SELECT ON public.v_tactical_alerts_top TO anon, authenticated;