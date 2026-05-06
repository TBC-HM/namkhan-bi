-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504141137
-- Name:    add_plan_otb_snapshots_and_cron
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Nightly OTB snapshot for true pace YoY comparison.
-- Each row: "as of snapshot_date, the night night_date had this much OTB confirmed_rooms / confirmed_revenue".
-- After 365 days of capture, pace can join (snapshot_date = today - 1 year) AND (night_date = today's stay-month bucket - 1 year)
-- to show "where was OTB pace at this lead time last year vs today".
CREATE SCHEMA IF NOT EXISTS plan;

CREATE TABLE IF NOT EXISTS plan.otb_snapshots (
  snapshot_date date NOT NULL,
  night_date    date NOT NULL,
  property_id   bigint NOT NULL,
  confirmed_rooms   integer NOT NULL,
  confirmed_revenue numeric NOT NULL,
  cancelled_rooms   integer DEFAULT 0,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, night_date, property_id)
);
CREATE INDEX IF NOT EXISTS idx_otb_snapshots_night ON plan.otb_snapshots(night_date);
CREATE INDEX IF NOT EXISTS idx_otb_snapshots_lead  ON plan.otb_snapshots(snapshot_date, (night_date - snapshot_date));

GRANT SELECT ON plan.otb_snapshots TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON plan.otb_snapshots TO service_role;

-- Capture function — call nightly, snapshots forward 365 days from snapshot_date
CREATE OR REPLACE FUNCTION public.f_capture_otb_snapshot()
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,plan,pg_temp AS $$
DECLARE n bigint;
BEGIN
  INSERT INTO plan.otb_snapshots(snapshot_date, night_date, property_id, confirmed_rooms, confirmed_revenue, cancelled_rooms)
  SELECT
    CURRENT_DATE,
    night_date,
    property_id,
    confirmed_rooms::int,
    confirmed_revenue::numeric,
    COALESCE(cancelled_rooms, 0)::int
  FROM public.v_otb_pace
  WHERE property_id = 260955
    AND night_date >= CURRENT_DATE
    AND night_date <= CURRENT_DATE + INTERVAL '365 days'
  ON CONFLICT (snapshot_date, night_date, property_id) DO UPDATE
    SET confirmed_rooms   = EXCLUDED.confirmed_rooms,
        confirmed_revenue = EXCLUDED.confirmed_revenue,
        cancelled_rooms   = EXCLUDED.cancelled_rooms,
        captured_at       = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.f_capture_otb_snapshot() TO service_role;

-- Reader function: for a given window, return per-night STLY OTB-snapshot pace.
-- Uses snapshot taken approx 1 year ago at the same lead-time.
-- Returns NULL when no snapshot 365 days back exists yet (first year of capture).
CREATE OR REPLACE FUNCTION public.f_pace_stly_snapshot(p_from date, p_to date)
RETURNS TABLE (night_date date, stly_snapshot_rooms integer, stly_snapshot_revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,plan,pg_temp AS $$
  -- For each forward night, find the snapshot taken exactly 365 days ago
  -- looking at the corresponding shifted night.
  SELECT
    s.night_date + INTERVAL '365 days' AS night_date,
    s.confirmed_rooms AS stly_snapshot_rooms,
    s.confirmed_revenue AS stly_snapshot_revenue
  FROM plan.otb_snapshots s
  WHERE s.property_id = 260955
    AND s.snapshot_date = (CURRENT_DATE - INTERVAL '365 days')
    AND s.night_date BETWEEN (p_from - INTERVAL '365 days') AND (p_to - INTERVAL '365 days');
$$;
GRANT EXECUTE ON FUNCTION public.f_pace_stly_snapshot(date, date) TO anon, authenticated, service_role;

-- Cron: capture nightly at 00:30 ICT (UTC+7) = 17:30 UTC. Why ICT-late: OTB
-- has already settled for the day and any new bookings have come in. Fires
-- at 17:30 UTC daily.
SELECT cron.schedule(
  'capture-otb-snapshot-daily',
  '30 17 * * *',
  $cron$ SELECT public.f_capture_otb_snapshot(); $cron$
);

-- Capture today's snapshot immediately so we start accumulating today.
SELECT public.f_capture_otb_snapshot();