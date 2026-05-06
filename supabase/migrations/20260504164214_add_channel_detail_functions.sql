-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504164214
-- Name:    add_channel_detail_functions
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Daily revenue & bookings for a single source over a date range.
-- Aggregates from public.reservations check_in_date.
CREATE OR REPLACE FUNCTION public.f_channel_daily_for_range(p_source_name text, p_from date, p_to date)
RETURNS TABLE (day date, bookings bigint, room_nights bigint, gross_revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT
    r.check_in_date AS day,
    COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%') AS bookings,
    COALESCE(SUM(r.nights) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::bigint AS room_nights,
    COALESCE(SUM(r.total_amount) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::numeric AS gross_revenue
  FROM public.reservations r
  WHERE r.property_id = 260955
    AND r.source_name = p_source_name
    AND r.check_in_date BETWEEN p_from AND p_to
  GROUP BY r.check_in_date
  ORDER BY r.check_in_date;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_daily_for_range(text, date, date) TO anon, authenticated, service_role;

-- Room-type mix for a single source over a date range.
CREATE OR REPLACE FUNCTION public.f_channel_room_mix_for_range(p_source_name text, p_from date, p_to date)
RETURNS TABLE (room_type_name text, bookings bigint, room_nights bigint, gross_revenue numeric, share_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH agg AS (
    SELECT
      COALESCE(r.room_type_name, '—') AS room_type_name,
      COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%') AS bookings,
      COALESCE(SUM(r.nights) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::bigint AS room_nights,
      COALESCE(SUM(r.total_amount) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::numeric AS gross_revenue
    FROM public.reservations r
    WHERE r.property_id = 260955
      AND r.source_name = p_source_name
      AND r.check_in_date BETWEEN p_from AND p_to
    GROUP BY r.room_type_name
  ),
  total AS (SELECT SUM(gross_revenue) AS t FROM agg)
  SELECT a.room_type_name, a.bookings, a.room_nights, a.gross_revenue,
         CASE WHEN (SELECT t FROM total) > 0
              THEN ROUND(a.gross_revenue / (SELECT t FROM total) * 100, 1)
              ELSE 0::numeric
         END AS share_pct
  FROM agg a
  ORDER BY a.gross_revenue DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_room_mix_for_range(text, date, date) TO anon, authenticated, service_role;

-- Daily NEW bookings made (booking_date, not check-in) for this source — pickup velocity.
CREATE OR REPLACE FUNCTION public.f_channel_pickup_for_source(p_source_name text, p_lookback_days int DEFAULT 28)
RETURNS TABLE (day date, bookings bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT
    r.booking_date::date AS day,
    COUNT(*) AS bookings
  FROM public.reservations r
  WHERE r.property_id = 260955
    AND r.source_name = p_source_name
    AND r.booking_date::date BETWEEN (CURRENT_DATE - p_lookback_days) AND CURRENT_DATE
  GROUP BY r.booking_date::date
  ORDER BY r.booking_date::date;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_pickup_for_source(text, int) TO anon, authenticated, service_role;