-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503145610
-- Name:    phase4_pickup_velocity_28d
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE VIEW public.v_pickup_velocity_28d AS
WITH days AS (
  SELECT generate_series(CURRENT_DATE - 27, CURRENT_DATE, '1 day'::interval)::date AS day
),
bookings AS (
  SELECT booking_date::date AS day, COUNT(*) AS bookings_made
  FROM public.reservations
  WHERE booking_date::date BETWEEN CURRENT_DATE - 27 AND CURRENT_DATE
    AND NOT is_cancelled
  GROUP BY 1
)
SELECT 
  d.day,
  COALESCE(b.bookings_made, 0)::int AS bookings_made,
  ROUND(AVG(COALESCE(b.bookings_made, 0)) OVER (
    ORDER BY d.day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ), 1) AS ma_7d,
  CASE 
    WHEN d.day >= CURRENT_DATE - 1  THEN 'last_2_days'
    WHEN d.day >= CURRENT_DATE - 21 THEN 'last_3_wks'
    ELSE '4_wks_ago'
  END AS bucket
FROM days d
LEFT JOIN bookings b ON b.day = d.day
ORDER BY d.day;

GRANT SELECT ON public.v_pickup_velocity_28d TO anon, authenticated;
