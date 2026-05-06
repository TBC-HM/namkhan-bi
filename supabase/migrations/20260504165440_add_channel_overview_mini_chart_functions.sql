-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504165440
-- Name:    add_channel_overview_mini_chart_functions
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- A. Channel-mix weekly trend over a date range. Buckets reservations by
--    week of check_in_date, splits into Direct/OTA/Wholesale/Other, returns
--    one row per (week_start, category).
CREATE OR REPLACE FUNCTION public.f_channel_mix_weekly_trend(p_from date, p_to date)
RETURNS TABLE (week_start date, category text, gross_revenue numeric, share_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH base AS (
    SELECT
      date_trunc('week', r.check_in_date)::date AS week_start,
      CASE
        WHEN r.source_name ILIKE '%booking.com%' OR r.source_name ILIKE '%expedia%'
          OR r.source_name ILIKE '%agoda%' OR r.source_name ILIKE '%airbnb%'
          OR r.source_name ILIKE '%ctrip%' OR r.source_name ILIKE '%trip.com%'
          OR r.source_name ILIKE '%hotels.com%' OR r.source_name ILIKE '%traveloka%'
          OR r.source_name ILIKE '%synxis%'
          THEN 'OTA'
        WHEN r.source_name ILIKE '%direct%' OR r.source_name ILIKE '%website%'
          OR r.source_name ILIKE '%booking engine%' OR r.source_name ILIKE '%email%'
          OR r.source_name ILIKE '%walk%'
          THEN 'Direct'
        WHEN r.source_name ILIKE '%hotelbeds%' OR r.source_name ILIKE '%wholesale%'
          OR r.source_name ILIKE '%dmc%' OR r.source_name ILIKE '%bonotel%'
          OR r.source_name ILIKE '%miki%' OR r.source_name ILIKE '%khiri%'
          OR r.source_name ILIKE '%trails of%'
          THEN 'Wholesale'
        ELSE 'Other'
      END AS category,
      COALESCE(r.total_amount, 0)::numeric AS gross_revenue
    FROM public.reservations r
    WHERE r.property_id = 260955
      AND r.check_in_date BETWEEN p_from AND p_to
      AND r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'
      AND r.source_name IS NOT NULL
  ),
  weekly AS (
    SELECT week_start, category, SUM(gross_revenue) AS gross_revenue
    FROM base GROUP BY week_start, category
  ),
  weekly_total AS (
    SELECT week_start, SUM(gross_revenue) AS week_total
    FROM weekly GROUP BY week_start
  )
  SELECT w.week_start, w.category, w.gross_revenue,
         CASE WHEN wt.week_total > 0
              THEN ROUND(w.gross_revenue / wt.week_total * 100, 1)
              ELSE 0::numeric
         END AS share_pct
  FROM weekly w
  JOIN weekly_total wt ON wt.week_start = w.week_start
  ORDER BY w.week_start, w.category;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_mix_weekly_trend(date, date) TO anon, authenticated, service_role;

-- B. Net revenue per booking (cancel-adjusted) by source for a date range.
--    Net rev/booking = (gross × (1 - cancel_pct/100) × (1 - commission_pct/100)) / bookings
--    Ranks sources by this number — tells you who's actually most profitable.
CREATE OR REPLACE FUNCTION public.f_channel_net_value_for_range(p_from date, p_to date)
RETURNS TABLE (source_name text, bookings bigint, net_value_per_booking numeric, gross_revenue numeric, commission_pct numeric, cancel_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH agg AS (
    SELECT
      r.source_name,
      COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%') AS bookings,
      COUNT(*) FILTER (WHERE r.status ILIKE '%cancel%') AS canceled,
      COALESCE(SUM(r.total_amount) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::numeric AS gross_revenue
    FROM public.reservations r
    WHERE r.property_id = 260955
      AND r.check_in_date BETWEEN p_from AND p_to
      AND r.source_name IS NOT NULL AND r.source_name <> ''
    GROUP BY r.source_name
    HAVING COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%') >= 2
  ),
  comm AS (
    SELECT name, MAX(commission_pct)::numeric AS commission_pct
    FROM public.sources WHERE commission_pct IS NOT NULL GROUP BY name
  )
  SELECT
    a.source_name,
    a.bookings,
    CASE WHEN a.bookings > 0
         THEN ROUND(
                a.gross_revenue / a.bookings
                * (1 - COALESCE(c.commission_pct, 0) / 100)
                * (1 - (a.canceled::numeric / NULLIF(a.bookings + a.canceled, 0)))
              , 2)
         ELSE 0::numeric
    END AS net_value_per_booking,
    a.gross_revenue,
    COALESCE(c.commission_pct, 0)::numeric,
    CASE WHEN (a.bookings + a.canceled) > 0
         THEN ROUND(a.canceled::numeric / (a.bookings + a.canceled) * 100, 1)
         ELSE 0::numeric
    END AS cancel_pct
  FROM agg a
  LEFT JOIN comm c ON c.name = a.source_name
  ORDER BY net_value_per_booking DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_net_value_for_range(date, date) TO anon, authenticated, service_role;

-- C. Daily new-booking velocity by category for the last 28 days.
--    Reservations.booking_date (when booked, not when staying), grouped by
--    OTA/Direct/Wholesale/Other category.
CREATE OR REPLACE FUNCTION public.f_channel_velocity_28d_by_cat()
RETURNS TABLE (day date, category text, bookings bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT
    r.booking_date::date AS day,
    CASE
      WHEN r.source_name ILIKE '%booking.com%' OR r.source_name ILIKE '%expedia%'
        OR r.source_name ILIKE '%agoda%' OR r.source_name ILIKE '%airbnb%'
        OR r.source_name ILIKE '%ctrip%' OR r.source_name ILIKE '%trip.com%'
        OR r.source_name ILIKE '%hotels.com%' OR r.source_name ILIKE '%traveloka%'
        OR r.source_name ILIKE '%synxis%'
        THEN 'OTA'
      WHEN r.source_name ILIKE '%direct%' OR r.source_name ILIKE '%website%'
        OR r.source_name ILIKE '%booking engine%' OR r.source_name ILIKE '%email%'
        OR r.source_name ILIKE '%walk%'
        THEN 'Direct'
      WHEN r.source_name ILIKE '%hotelbeds%' OR r.source_name ILIKE '%wholesale%'
        OR r.source_name ILIKE '%dmc%' OR r.source_name ILIKE '%bonotel%'
        OR r.source_name ILIKE '%miki%' OR r.source_name ILIKE '%khiri%'
        OR r.source_name ILIKE '%trails of%'
        THEN 'Wholesale'
      ELSE 'Other'
    END AS category,
    COUNT(*) AS bookings
  FROM public.reservations r
  WHERE r.property_id = 260955
    AND r.booking_date::date BETWEEN (CURRENT_DATE - 27) AND CURRENT_DATE
    AND r.source_name IS NOT NULL
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_velocity_28d_by_cat() TO anon, authenticated, service_role;