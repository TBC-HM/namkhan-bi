-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502140905
-- Name:    fix_mv_channel_x_roomtype_today_and_forward_windows
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


DROP MATERIALIZED VIEW IF EXISTS public.mv_channel_x_roomtype CASCADE;

CREATE MATERIALIZED VIEW public.mv_channel_x_roomtype AS
WITH backward AS (
  SELECT 1::int    AS window_days, r.* FROM reservations r WHERE r.booking_date::date = CURRENT_DATE
  UNION ALL SELECT 7,    r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 7
  UNION ALL SELECT 30,   r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 30
  UNION ALL SELECT 90,   r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 90
  UNION ALL SELECT 365,  r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 365
  UNION ALL SELECT 9999, r.* FROM reservations r WHERE r.booking_date >= date_trunc('year', CURRENT_DATE)
),
forward AS (
  SELECT -7::int AS window_days, r.* FROM reservations r 
  WHERE r.check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 AND NOT r.is_cancelled
  UNION ALL SELECT -30, r.* FROM reservations r 
  WHERE r.check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 AND NOT r.is_cancelled
  UNION ALL SELECT -90, r.* FROM reservations r 
  WHERE r.check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90 AND NOT r.is_cancelled
),
all_scoped AS (
  SELECT * FROM backward UNION ALL SELECT * FROM forward
)
SELECT
  a.property_id,
  a.source_name,
  rt.room_type_name,
  rt.room_type_name_short,
  a.window_days,
  COUNT(*) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS bookings,
  COUNT(*) FILTER (WHERE a.status = 'canceled')                  AS canceled,
  SUM(rr.rate) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS revenue,
  COUNT(rr.*)  FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS roomnights,
  CASE
    WHEN COUNT(rr.*) FILTER (WHERE a.status NOT IN ('canceled','no_show')) > 0
    THEN ROUND(
      SUM(rr.rate) FILTER (WHERE a.status NOT IN ('canceled','no_show'))
      / NULLIF(COUNT(rr.*) FILTER (WHERE a.status NOT IN ('canceled','no_show')), 0)::numeric,
      2)
    ELSE 0
  END AS adr,
  CASE
    WHEN COUNT(*) FILTER (WHERE a.status NOT IN ('canceled','no_show')) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE a.status = 'canceled')::numeric * 100.0
      / NULLIF(COUNT(*) FILTER (WHERE a.status NOT IN ('canceled','no_show')), 0)::numeric,
      2)
    ELSE 0
  END AS cancel_pct
FROM all_scoped a
JOIN reservation_rooms rr ON rr.reservation_id = a.reservation_id
JOIN room_types rt        ON rt.room_type_id   = rr.room_type_id
GROUP BY a.property_id, a.source_name, rt.room_type_name, rt.room_type_name_short, a.window_days;

CREATE UNIQUE INDEX mv_channel_x_roomtype_pk
  ON public.mv_channel_x_roomtype (property_id, source_name, room_type_name, window_days);
CREATE INDEX mv_channel_x_roomtype_window_idx
  ON public.mv_channel_x_roomtype (window_days);

GRANT SELECT ON public.mv_channel_x_roomtype TO authenticated, anon;
