-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427202006
-- Name:    create_system_health_views_v4
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW dq.v_system_health AS
WITH health AS (
  SELECT 'reservations' AS source,
    (SELECT COUNT(*) FROM public.reservations) AS row_count,
    (SELECT MAX(updated_at) FROM public.reservations) AS last_update,
    EXTRACT(EPOCH FROM (now() - (SELECT MAX(updated_at) FROM public.reservations)))/3600 AS hours_stale
  UNION ALL
  SELECT 'transactions', 
    (SELECT COUNT(*) FROM public.transactions),
    (SELECT MAX(synced_at) FROM public.transactions),
    EXTRACT(EPOCH FROM (now() - (SELECT MAX(synced_at) FROM public.transactions)))/3600
  UNION ALL
  SELECT 'daily_metrics', 
    (SELECT COUNT(*) FROM public.daily_metrics),
    (SELECT MAX(synced_at) FROM public.daily_metrics),
    EXTRACT(EPOCH FROM (now() - (SELECT MAX(synced_at) FROM public.daily_metrics)))/3600
  UNION ALL
  SELECT 'gl.pnl_snapshot', 
    (SELECT COUNT(*) FROM gl.pnl_snapshot),
    (SELECT MAX(imported_at) FROM gl.pnl_snapshot),
    EXTRACT(EPOCH FROM (now() - (SELECT MAX(imported_at) FROM gl.pnl_snapshot)))/3600
  UNION ALL
  SELECT 'plan.lines',
    (SELECT COUNT(*) FROM plan.lines),
    NULL::timestamptz,
    NULL::double precision
  UNION ALL
  SELECT 'fx_rates',
    (SELECT COUNT(*) FROM gl.fx_rates),
    (SELECT MAX(rate_date)::timestamptz FROM gl.fx_rates),
    ((CURRENT_DATE - (SELECT MAX(rate_date) FROM gl.fx_rates))::int * 24)::double precision
)
SELECT 
  source,
  row_count,
  last_update,
  ROUND(hours_stale::numeric, 1) AS hours_since_update,
  CASE 
    WHEN hours_stale IS NULL THEN '⚪ Static'
    WHEN hours_stale < 6 THEN '🟢 Fresh'
    WHEN hours_stale < 24 THEN '🟡 Stale'
    ELSE '🔴 Critical'
  END AS health_status
FROM health
ORDER BY hours_stale DESC NULLS LAST;

CREATE OR REPLACE VIEW dq.v_summary AS
SELECT 
  severity,
  COUNT(*) FILTER (WHERE resolved_at IS NULL) AS unresolved,
  COUNT(*) FILTER (WHERE resolved_at IS NULL AND detected_at >= now() - interval '24 hours') AS last_24h,
  COUNT(*) AS total_ever
FROM dq.violations
GROUP BY severity
ORDER BY 
  CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END;

CREATE OR REPLACE VIEW dq.v_cron_health AS
SELECT 
  j.jobid, j.jobname, j.schedule, j.active,
  jrd.last_run_status, jrd.last_run_started, 
  jrd.last_run_duration_sec, jrd.last_run_return_message
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT 
    status AS last_run_status,
    start_time AS last_run_started,
    EXTRACT(EPOCH FROM (end_time - start_time))::int AS last_run_duration_sec,
    return_message AS last_run_return_message
  FROM cron.job_run_details
  WHERE jobid = j.jobid
  ORDER BY start_time DESC LIMIT 1
) jrd ON true
ORDER BY j.jobid;

CREATE OR REPLACE VIEW dq.v_alerts_active AS
SELECT 
  v.violation_id, v.rule_id, r.rule_name, v.severity,
  v.entity_type, v.entity_id, v.details, v.detected_at,
  ROUND(EXTRACT(EPOCH FROM (now() - v.detected_at))::numeric/3600, 1) AS hours_open
FROM dq.violations v
JOIN dq.rules r USING (rule_id)
WHERE v.resolved_at IS NULL AND v.severity IN ('CRITICAL','WARNING')
ORDER BY 
  CASE v.severity WHEN 'CRITICAL' THEN 1 ELSE 2 END,
  v.detected_at DESC;