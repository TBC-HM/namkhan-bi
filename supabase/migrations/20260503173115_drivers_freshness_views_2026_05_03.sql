-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503173115
-- Name:    drivers_freshness_views_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Drivers stack view — easy lookup of room_nights/adr/occ/rooms_available per scenario × month
CREATE OR REPLACE VIEW gl.v_drivers_stack AS
SELECT
  (d.period_year::text || '-' || lpad(d.period_month::text,2,'0')) AS period_yyyymm,
  s.name AS scenario_name,
  s.scenario_type,
  d.driver_key,
  d.value_numeric,
  d.notes
FROM plan.drivers d
JOIN plan.scenarios s ON s.scenario_id = d.scenario_id;

GRANT SELECT ON gl.v_drivers_stack TO anon, service_role;

-- Freshness summary — count stale matviews + most recent refresh timestamp
CREATE OR REPLACE VIEW gl.v_freshness_summary AS
WITH latest AS (
  SELECT DISTINCT ON (matview) matview, last_refresh, staleness_minutes, is_stale, threshold_minutes, checked_at
  FROM kpi.freshness_log
  ORDER BY matview, checked_at DESC
)
SELECT count(*)                                     AS matview_count,
       count(*) FILTER (WHERE is_stale)             AS stale_count,
       max(last_refresh)                            AS latest_refresh_at,
       min(staleness_minutes)                       AS freshest_minutes,
       max(staleness_minutes)                       AS stalest_minutes
FROM latest;

GRANT SELECT ON gl.v_freshness_summary TO anon, service_role;

-- Grant access to the underlying tables we now read through these views
GRANT SELECT ON kpi.freshness_log TO anon, service_role;
GRANT USAGE ON SCHEMA kpi TO anon, service_role;