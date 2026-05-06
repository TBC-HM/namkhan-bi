-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502223037
-- Name:    phase1_14b_dq_view_fix_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP VIEW IF EXISTS public.v_overview_dq;
CREATE VIEW public.v_overview_dq AS
SELECT
  count(*)                                                            AS open_total,
  count(*) FILTER (WHERE r.severity = 'CRITICAL')                     AS open_critical,
  count(*) FILTER (WHERE r.severity = 'WARNING')                      AS open_warning,
  count(*) FILTER (WHERE r.severity = 'INFO')                         AS open_info,
  count(*) FILTER (WHERE v.detected_at > now() - interval '24 hours') AS new_24h,
  count(*) FILTER (WHERE r.severity IN ('CRITICAL','WARNING'))        AS action_required
FROM dq.violations v
LEFT JOIN dq.rules r ON r.rule_id = v.rule_id
WHERE v.resolved_at IS NULL;

COMMENT ON VIEW public.v_overview_dq IS
  'open_total = all unresolved violations. '
  'action_required = CRITICAL+WARNING (best tile metric, excludes INFO noise). '
  'INFO violations are informational and should not appear on alert tiles.';