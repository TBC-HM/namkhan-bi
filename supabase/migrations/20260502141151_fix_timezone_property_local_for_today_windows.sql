-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502141151
-- Name:    fix_timezone_property_local_for_today_windows
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- The hotel is in Laos (UTC+7, Asia/Vientiane). Every "today" filter
-- must use the property's local date, not UTC.
--
-- Before this fix:
--   booking_date::date = CURRENT_DATE  →  uses UTC date conversion
--   → Jorge Pena Torres (booked 22:39 UTC May 1 = 05:39 local May 2)
--     is bucketed as May 1, not May 2
--
-- Fix: normalize booking_date to property timezone before casting to date.
-- =====================================================================

-- Helper: converts any timestamptz to the property's local date.
CREATE OR REPLACE FUNCTION public.property_local_date(ts timestamptz)
RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT (ts AT TIME ZONE 'Asia/Vientiane')::date
$$;
COMMENT ON FUNCTION public.property_local_date(timestamptz) IS
  'Convert any timestamptz to The Namkhan local date (Asia/Vientiane / UTC+7). Use this in every view that buckets data by day.';

-- Helper: returns property "today" (Laos local)
CREATE OR REPLACE FUNCTION public.property_today()
RETURNS date
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Vientiane')::date
$$;
COMMENT ON FUNCTION public.property_today() IS
  'Returns today in The Namkhan local time. Use INSTEAD OF CURRENT_DATE for any property-time-sensitive logic.';

-- =====================================================================
-- Rebuild mv_channel_economics with property-local time
-- =====================================================================
DROP MATERIALIZED VIEW IF EXISTS public.mv_channel_economics CASCADE;

CREATE MATERIALIZED VIEW public.mv_channel_economics AS
WITH t AS (SELECT public.property_today() AS today),
backward AS (
  SELECT 1::int AS window_days, r.* FROM reservations r, t
  WHERE public.property_local_date(r.booking_date) = t.today
  UNION ALL SELECT 7,    r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 7
  UNION ALL SELECT 30,   r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 30
  UNION ALL SELECT 60,   r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 60
  UNION ALL SELECT 90,   r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 90
  UNION ALL SELECT 180,  r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 180
  UNION ALL SELECT 365,  r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 365
  UNION ALL SELECT 9999, r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= date_trunc('year', t.today)
),
forward AS (
  SELECT -7::int AS window_days, r.* FROM reservations r, t
  WHERE r.check_in_date BETWEEN t.today AND t.today + 7 AND NOT r.is_cancelled
  UNION ALL SELECT -30, r.* FROM reservations r, t
  WHERE r.check_in_date BETWEEN t.today AND t.today + 30 AND NOT r.is_cancelled
  UNION ALL SELECT -90, r.* FROM reservations r, t
  WHERE r.check_in_date BETWEEN t.today AND t.today + 90 AND NOT r.is_cancelled
),
all_scoped AS (SELECT * FROM backward UNION ALL SELECT * FROM forward),
booked AS (
  SELECT a.property_id, a.source_name, a.window_days,
    COUNT(*) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS bookings,
    COUNT(*) FILTER (WHERE a.status = 'canceled') AS canceled,
    SUM(a.total_amount) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS gross_revenue,
    SUM(a.nights)       FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS roomnights,
    AVG(EXTRACT(epoch FROM a.check_in_date::timestamptz - a.booking_date) / 86400)
        FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS avg_lead_days,
    AVG(a.nights) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS avg_los
  FROM all_scoped a
  GROUP BY a.property_id, a.source_name, a.window_days
)
SELECT b.property_id, b.source_name, b.window_days,
  b.bookings, b.canceled,
  COALESCE(b.gross_revenue, 0) AS gross_revenue,
  COALESCE(b.roomnights, 0)    AS roomnights,
  COALESCE(cl.commission_pct, 0) AS commission_pct,
  ROUND(COALESCE(b.gross_revenue, 0) * COALESCE(cl.commission_pct, 0) / 100, 2) AS commission_usd,
  ROUND(COALESCE(b.gross_revenue, 0) * (1 - COALESCE(cl.commission_pct, 0) / 100), 2) AS net_revenue,
  CASE WHEN b.bookings > 0 THEN ROUND(COALESCE(b.gross_revenue, 0) / b.bookings, 2) ELSE 0 END AS adr,
  CASE WHEN b.bookings > 0 THEN ROUND(b.canceled::numeric * 100.0 / b.bookings, 2) ELSE 0 END AS cancel_pct,
  ROUND(b.avg_lead_days::numeric, 1) AS avg_lead_days,
  ROUND(b.avg_los::numeric,       2) AS avg_los
FROM booked b
LEFT JOIN v_commission_lookup cl ON cl.source_name = b.source_name;

CREATE UNIQUE INDEX mv_channel_economics_pk
  ON public.mv_channel_economics (property_id, source_name, window_days);
CREATE INDEX mv_channel_economics_window_idx ON public.mv_channel_economics (window_days);
GRANT SELECT ON public.mv_channel_economics TO authenticated, anon;

-- =====================================================================
-- Rebuild mv_channel_x_roomtype with property-local time
-- =====================================================================
DROP MATERIALIZED VIEW IF EXISTS public.mv_channel_x_roomtype CASCADE;

CREATE MATERIALIZED VIEW public.mv_channel_x_roomtype AS
WITH t AS (SELECT public.property_today() AS today),
backward AS (
  SELECT 1::int    AS window_days, r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) = t.today
  UNION ALL SELECT 7,    r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 7
  UNION ALL SELECT 30,   r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 30
  UNION ALL SELECT 90,   r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 90
  UNION ALL SELECT 365,  r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= t.today - 365
  UNION ALL SELECT 9999, r.* FROM reservations r, t WHERE public.property_local_date(r.booking_date) >= date_trunc('year', t.today)
),
forward AS (
  SELECT -7::int AS window_days, r.* FROM reservations r, t
  WHERE r.check_in_date BETWEEN t.today AND t.today + 7 AND NOT r.is_cancelled
  UNION ALL SELECT -30, r.* FROM reservations r, t
  WHERE r.check_in_date BETWEEN t.today AND t.today + 30 AND NOT r.is_cancelled
  UNION ALL SELECT -90, r.* FROM reservations r, t
  WHERE r.check_in_date BETWEEN t.today AND t.today + 90 AND NOT r.is_cancelled
),
all_scoped AS (SELECT * FROM backward UNION ALL SELECT * FROM forward)
SELECT
  a.property_id, a.source_name, rt.room_type_name, rt.room_type_name_short, a.window_days,
  COUNT(*) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS bookings,
  COUNT(*) FILTER (WHERE a.status = 'canceled') AS canceled,
  SUM(rr.rate) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS revenue,
  COUNT(rr.*)  FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS roomnights,
  CASE WHEN COUNT(rr.*) FILTER (WHERE a.status NOT IN ('canceled','no_show')) > 0
       THEN ROUND(SUM(rr.rate) FILTER (WHERE a.status NOT IN ('canceled','no_show'))
                  / NULLIF(COUNT(rr.*) FILTER (WHERE a.status NOT IN ('canceled','no_show')), 0)::numeric, 2)
       ELSE 0 END AS adr,
  CASE WHEN COUNT(*) FILTER (WHERE a.status NOT IN ('canceled','no_show')) > 0
       THEN ROUND(COUNT(*) FILTER (WHERE a.status = 'canceled')::numeric * 100.0
                  / NULLIF(COUNT(*) FILTER (WHERE a.status NOT IN ('canceled','no_show')), 0)::numeric, 2)
       ELSE 0 END AS cancel_pct
FROM all_scoped a
JOIN reservation_rooms rr ON rr.reservation_id = a.reservation_id
JOIN room_types rt        ON rt.room_type_id   = rr.room_type_id
GROUP BY a.property_id, a.source_name, rt.room_type_name, rt.room_type_name_short, a.window_days;

CREATE UNIQUE INDEX mv_channel_x_roomtype_pk
  ON public.mv_channel_x_roomtype (property_id, source_name, room_type_name, window_days);
CREATE INDEX mv_channel_x_roomtype_window_idx ON public.mv_channel_x_roomtype (window_days);
GRANT SELECT ON public.mv_channel_x_roomtype TO authenticated, anon;
