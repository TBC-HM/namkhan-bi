-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503145550
-- Name:    phase3_room_type_pulse_function
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


DROP VIEW IF EXISTS public.v_room_type_perf CASCADE;
DROP VIEW IF EXISTS public.v_room_type_pulse_30d CASCADE;
DROP VIEW IF EXISTS public.v_room_type_pulse_90d CASCADE;
DROP FUNCTION IF EXISTS public.f_room_type_pulse(int);

CREATE OR REPLACE FUNCTION public.f_room_type_pulse(p_window_days int DEFAULT 30)
RETURNS TABLE (
  room_type_id       bigint,
  room_type_name     text,
  rooms              int,
  capacity_nights    int,
  room_nights_sold   int,
  occupancy_pct      numeric,
  adr_usd            numeric,
  revenue_usd        numeric,
  occupancy_pct_stly numeric,
  adr_usd_stly       numeric,
  revenue_usd_stly   numeric
)
LANGUAGE sql STABLE AS $$
WITH cur AS (
  SELECT rr.room_type_id,
         COUNT(*) AS nights,
         ROUND(AVG(NULLIF(rr.rate, 0)), 0) AS adr,
         ROUND(SUM(rr.rate), 0) AS rev
  FROM public.reservation_rooms rr
  JOIN public.reservations r 
    ON r.reservation_id = rr.reservation_id 
   AND NOT r.is_cancelled
  WHERE rr.night_date BETWEEN CURRENT_DATE - p_window_days AND CURRENT_DATE - 1
  GROUP BY rr.room_type_id
),
stly AS (
  SELECT rr.room_type_id,
         COUNT(*) AS nights,
         ROUND(AVG(NULLIF(rr.rate, 0)), 0) AS adr,
         ROUND(SUM(rr.rate), 0) AS rev
  FROM public.reservation_rooms rr
  JOIN public.reservations r 
    ON r.reservation_id = rr.reservation_id 
   AND NOT r.is_cancelled
  WHERE rr.night_date BETWEEN CURRENT_DATE - p_window_days - 365 AND CURRENT_DATE - 1 - 365
  GROUP BY rr.room_type_id
)
SELECT 
  rt.room_type_id,
  rt.room_type_name,
  rt.quantity AS rooms,
  (rt.quantity * p_window_days)::int AS capacity_nights,
  COALESCE(cur.nights, 0)::int AS room_nights_sold,
  ROUND(100.0 * COALESCE(cur.nights, 0) / NULLIF(rt.quantity * p_window_days, 0), 1) AS occupancy_pct,
  cur.adr  AS adr_usd,
  cur.rev  AS revenue_usd,
  ROUND(100.0 * COALESCE(stly.nights, 0) / NULLIF(rt.quantity * p_window_days, 0), 1) AS occupancy_pct_stly,
  stly.adr AS adr_usd_stly,
  stly.rev AS revenue_usd_stly
FROM public.room_types rt
LEFT JOIN cur  ON cur.room_type_id  = rt.room_type_id
LEFT JOIN stly ON stly.room_type_id = rt.room_type_id
WHERE rt.quantity > 0
ORDER BY revenue_usd DESC NULLS LAST;
$$;

CREATE OR REPLACE VIEW public.v_room_type_pulse_30d AS
  SELECT * FROM public.f_room_type_pulse(30);

CREATE OR REPLACE VIEW public.v_room_type_pulse_90d AS
  SELECT * FROM public.f_room_type_pulse(90);

CREATE OR REPLACE VIEW public.v_room_type_pulse_7d AS
  SELECT * FROM public.f_room_type_pulse(7);

GRANT EXECUTE ON FUNCTION public.f_room_type_pulse(int) TO anon, authenticated;
GRANT SELECT ON public.v_room_type_pulse_7d, public.v_room_type_pulse_30d, public.v_room_type_pulse_90d 
  TO anon, authenticated;
