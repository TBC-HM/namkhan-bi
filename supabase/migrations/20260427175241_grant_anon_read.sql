-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427175241
-- Name:    grant_anon_read
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Grant read access to anon role on the analytics views & tables for dashboard
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Specifically grant on views
GRANT SELECT ON v_kpi_daily, v_pickup_30d, v_revenue_usali, v_channel_mix, 
                v_channel_summary, v_country_mix, v_lead_time, v_room_type_perf,
                v_arrivals_today, v_departures_today, v_inhouse TO anon;

-- Set default for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
