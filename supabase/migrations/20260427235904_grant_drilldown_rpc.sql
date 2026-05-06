-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427235904
-- Name:    grant_drilldown_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Expose drill functions to PostgREST so the dashboard can call them
GRANT USAGE ON SCHEMA kpi TO anon, authenticated;

GRANT EXECUTE ON FUNCTION kpi.period_range(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.headline(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_by_room(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_by_source(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_by_room_type(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_by_country(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_by_dow(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_by_segment(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_by_lead_time(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_by_los(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_timeseries(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kpi.drill_combo(text, text, text) TO anon, authenticated;