-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427175832
-- Name:    expose_views_to_anon
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Grant read on analytics views to anon for the dashboard
GRANT SELECT ON 
  v_kpi_daily, v_pickup_30d, v_revenue_usali, v_channel_mix, v_channel_summary,
  v_country_mix, v_lead_time, v_room_type_perf, 
  v_arrivals_today, v_departures_today, v_inhouse
TO anon, authenticated;

-- Grant SELECT on base tables (needed for some lookups)
GRANT SELECT ON hotels, rooms, room_types, sources TO anon, authenticated;

-- Enable RLS on tables (security best practice) and add public read policy
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_metrics ENABLE ROW LEVEL SECURITY;

-- Read-only policy for anon
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['hotels','rooms','room_types','sources','daily_metrics',
                                'reservations','reservation_rooms','transactions','guests','channel_metrics'])
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)',
                   'read_all_' || t, t);
  END LOOP;
END $$;

GRANT SELECT ON daily_metrics, reservations, reservation_rooms, transactions, guests, channel_metrics TO anon, authenticated;
