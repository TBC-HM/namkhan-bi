-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427220825
-- Name:    recreate_dq_dashboard_view
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW dq.v_dashboard AS
WITH 
  health AS (
    SELECT jsonb_object_agg(source, jsonb_build_object('rows', row_count, 'hours_stale', hours_since_update, 'status', health_status)) AS data
    FROM dq.v_system_health
  ),
  alerts AS (
    SELECT jsonb_object_agg(severity, unresolved) AS data
    FROM dq.v_summary
  ),
  cron AS (
    SELECT jsonb_agg(jsonb_build_object('job', jobname, 'schedule', schedule, 'last_status', last_run_status)) AS data
    FROM dq.v_cron_health
  ),
  pnl AS (
    SELECT jsonb_object_agg(pl_section, jsonb_build_object('budget', budget_usd, 'actual', actual_usd, 'stly', stly_usd)) AS data
    FROM plan.snapshot(EXTRACT(YEAR FROM CURRENT_DATE)::int)
    WHERE pl_section IN ('TOTAL REVENUE','GOP (Gross Operating Profit)','NET INCOME')
  ),
  reconciliation AS (
    SELECT jsonb_agg(jsonb_build_object(
      'period', period_year || '-' || lpad(period_month::text,2,'0'),
      'cb_net_implied', cb_net_implied_usd,
      'qb_net', qb_net_usd,
      'gap_pct', adjusted_gap_pct,
      'status', reconciliation_status
    ) ORDER BY period_year DESC, period_month DESC) AS data
    FROM gl.v_cb_qb_reconciliation_vat_adj
    WHERE period_year >= EXTRACT(YEAR FROM CURRENT_DATE)::int - 1
  ),
  occ AS (
    SELECT jsonb_build_object(
      'last_30d_avg_occ', ROUND(AVG(occupancy_pct), 1),
      'last_30d_avg_adr', ROUND(AVG(NULLIF(adr,0)), 2),
      'last_30d_revpar', ROUND(AVG(revpar), 2),
      'last_30d_total_rev', ROUND(SUM(total_revenue), 2)
    ) AS data
    FROM public.daily_metrics
    WHERE metric_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 1
      AND is_actual = true
  ),
  next_60d AS (
    SELECT jsonb_build_object(
      'next_60d_otb_rooms_sold', SUM(rooms_sold),
      'next_60d_otb_revenue', ROUND(SUM(rooms_revenue), 2),
      'next_60d_pace_index', ROUND(AVG(pace_index), 2)
    ) AS data
    FROM public.daily_metrics
    WHERE metric_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60
  )
SELECT 
  now() AS as_of,
  health.data AS pipeline_health,
  alerts.data AS dq_alerts,
  cron.data AS cron_status,
  pnl.data AS pnl_2026,
  reconciliation.data AS recent_reconciliation,
  occ.data AS recent_performance,
  next_60d.data AS forward_pace
FROM health, alerts, cron, pnl, reconciliation, occ, next_60d;