-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503184649
-- Name:    flag_views_for_ui_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE VIEW revenue.open_flags AS
SELECT 
  f.flag_id, f.rule_code, f.severity, fr.dimension,
  f.comp_id, f.property_name, f.channel, f.stay_date, f.taxonomy_code,
  f.observed_value, f.baseline_value, f.delta_value, f.delta_pct,
  f.event_context, f.is_event_escalated,
  f.flag_label, f.suggested_action, f.action_text,
  f.detected_at, f.detected_by_run_id,
  ROUND(EXTRACT(EPOCH FROM (NOW() - f.detected_at))::numeric / 3600, 1) AS age_hours,
  f.status
FROM revenue.flags f
LEFT JOIN revenue.flag_rules fr ON fr.rule_id = f.rule_id
WHERE f.status = 'open'
ORDER BY 
  CASE f.severity 
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 
    WHEN 'low' THEN 4 ELSE 5 END,
  f.detected_at DESC;

COMMENT ON VIEW revenue.open_flags IS 'Open flags sorted by severity then recency. Powers the flags strip on comp set page.';

-- Summary view for the top-of-page badge: count by severity
CREATE OR REPLACE VIEW revenue.flag_summary AS
SELECT
  COUNT(*) FILTER (WHERE status = 'open') AS total_open,
  COUNT(*) FILTER (WHERE status = 'open' AND severity = 'critical') AS critical_count,
  COUNT(*) FILTER (WHERE status = 'open' AND severity = 'high') AS high_count,
  COUNT(*) FILTER (WHERE status = 'open' AND severity = 'medium') AS medium_count,
  COUNT(*) FILTER (WHERE status = 'open' AND severity = 'low') AS low_count,
  COUNT(*) FILTER (WHERE status = 'open' AND is_event_escalated = true) AS event_escalated_count,
  MAX(detected_at) FILTER (WHERE status = 'open') AS most_recent_flag_at
FROM revenue.flags;
