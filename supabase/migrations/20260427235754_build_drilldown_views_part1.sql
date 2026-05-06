-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427235754
-- Name:    build_drilldown_views_part1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Universal period helper
CREATE OR REPLACE FUNCTION kpi.period_range(p_label text, p_anchor date DEFAULT CURRENT_DATE)
RETURNS TABLE(date_from date, date_to date)
LANGUAGE sql STABLE
AS $$
  SELECT 
    CASE p_label
      WHEN 'last_7'    THEN p_anchor - 7
      WHEN 'last_14'   THEN p_anchor - 14
      WHEN 'last_30'   THEN p_anchor - 30
      WHEN 'last_60'   THEN p_anchor - 60
      WHEN 'last_90'   THEN p_anchor - 90
      WHEN 'last_180'  THEN p_anchor - 180
      WHEN 'last_365'  THEN p_anchor - 365
      WHEN 'mtd'       THEN date_trunc('month', p_anchor)::date
      WHEN 'qtd'       THEN date_trunc('quarter', p_anchor)::date
      WHEN 'ytd'       THEN date_trunc('year', p_anchor)::date
      WHEN 'next_7'    THEN p_anchor
      WHEN 'next_30'   THEN p_anchor
      WHEN 'next_60'   THEN p_anchor
      WHEN 'next_90'   THEN p_anchor
      WHEN 'next_180'  THEN p_anchor
      WHEN 'next_365'  THEN p_anchor
      ELSE p_anchor - 30
    END AS date_from,
    CASE p_label
      WHEN 'last_7'    THEN p_anchor - 1
      WHEN 'last_14'   THEN p_anchor - 1
      WHEN 'last_30'   THEN p_anchor - 1
      WHEN 'last_60'   THEN p_anchor - 1
      WHEN 'last_90'   THEN p_anchor - 1
      WHEN 'last_180'  THEN p_anchor - 1
      WHEN 'last_365'  THEN p_anchor - 1
      WHEN 'mtd'       THEN p_anchor - 1
      WHEN 'qtd'       THEN p_anchor - 1
      WHEN 'ytd'       THEN p_anchor - 1
      WHEN 'next_7'    THEN p_anchor + 7
      WHEN 'next_30'   THEN p_anchor + 30
      WHEN 'next_60'   THEN p_anchor + 60
      WHEN 'next_90'   THEN p_anchor + 90
      WHEN 'next_180'  THEN p_anchor + 180
      WHEN 'next_365'  THEN p_anchor + 365
      ELSE p_anchor - 1
    END AS date_to;
$$;

-- DRILL: by ROOM
CREATE OR REPLACE FUNCTION kpi.drill_by_room(p_period text DEFAULT 'last_30')
RETURNS TABLE(
  room_id text, room_name text, is_active boolean,
  room_nights bigint, rooms_revenue numeric, adr numeric,
  occupancy_pct numeric, available_nights bigint
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  RETURN QUERY
  WITH all_rooms AS (
    SELECT r.room_id, r.room_name, r.is_active FROM public.rooms r
    UNION
    SELECT DISTINCT rr.room_id, '(phantom)', false
    FROM public.reservation_rooms rr
    LEFT JOIN public.rooms r ON r.room_id = rr.room_id
    WHERE r.room_id IS NULL AND rr.room_id IS NOT NULL
  ),
  bookings AS (
    SELECT rr.room_id, COUNT(*)::bigint AS rn, SUM(rr.rate) AS rev
    FROM public.reservation_rooms rr
    JOIN public.reservations res ON res.reservation_id = rr.reservation_id
    WHERE rr.night_date BETWEEN v_from AND v_to
      AND NOT res.is_cancelled
      AND res.status NOT IN ('canceled','no_show')
      AND rr.rate > 0
    GROUP BY rr.room_id
  )
  SELECT 
    ar.room_id,
    COALESCE(ar.room_name, '(unknown)'),
    ar.is_active,
    COALESCE(b.rn, 0)::bigint,
    ROUND(COALESCE(b.rev, 0)::numeric, 2),
    ROUND(COALESCE(b.rev / NULLIF(b.rn, 0), 0)::numeric, 2),
    ROUND(100.0 * COALESCE(b.rn, 0) / (v_to - v_from + 1), 2),
    (v_to - v_from + 1)::bigint
  FROM all_rooms ar
  LEFT JOIN bookings b ON b.room_id = ar.room_id
  ORDER BY COALESCE(b.rev, 0) DESC;
END;
$func$;

-- DRILL: by SOURCE
CREATE OR REPLACE FUNCTION kpi.drill_by_source(p_period text DEFAULT 'last_30')
RETURNS TABLE(
  source text, reservations bigint, room_nights bigint,
  rooms_revenue numeric, adr numeric, pct_of_revenue numeric,
  est_commission_pct numeric, net_adr numeric, net_revenue numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  RETURN QUERY
  WITH commission_rates AS (
    SELECT * FROM (VALUES
      ('Booking.com', 0.15),('Expedia', 0.18),('CTrip', 0.15),
      ('Trip.com', 0.15),('Traveloka', 0.15),('Agoda', 0.15),
      ('Website', 0.0),('Email', 0.0),('Walk-In', 0.0),
      ('Khiri', 0.20),('Retreat', 0.25),('SynXis', 0.10),
      ('Hospitality Solutions', 0.10),('Hilton', 0.0),
      ('Amica', 0.20),('Tripaneer', 0.25)
    ) AS t(kw, rate)
  ),
  agg AS (
    SELECT 
      COALESCE(s.name, r.source_name, 'Unknown') AS src,
      COUNT(DISTINCT r.reservation_id) AS res,
      COUNT(rr.id) AS rn,
      SUM(rr.rate) AS rev
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    LEFT JOIN public.sources s ON s.source_id = r.source
    WHERE rr.night_date BETWEEN v_from AND v_to
      AND NOT r.is_cancelled
      AND r.status NOT IN ('canceled','no_show')
      AND rr.rate > 0
    GROUP BY 1
  ),
  with_comm AS (
    SELECT 
      a.*,
      COALESCE((SELECT cr.rate FROM commission_rates cr WHERE a.src ILIKE '%' || cr.kw || '%' ORDER BY length(cr.kw) DESC LIMIT 1), 0.10) AS comm_rate
    FROM agg a
  ),
  total AS (SELECT SUM(rev) AS t FROM with_comm)
  SELECT 
    wc.src,
    wc.res::bigint,
    wc.rn::bigint,
    ROUND(wc.rev::numeric, 2),
    ROUND((wc.rev / NULLIF(wc.rn, 0))::numeric, 2),
    ROUND(100.0 * wc.rev / NULLIF(t.t, 0), 2),
    ROUND((wc.comm_rate * 100)::numeric, 0),
    ROUND((wc.rev / NULLIF(wc.rn, 0) * (1 - wc.comm_rate))::numeric, 2),
    ROUND((wc.rev * (1 - wc.comm_rate))::numeric, 2)
  FROM with_comm wc CROSS JOIN total t
  ORDER BY wc.rev DESC;
END;
$func$;

-- DRILL: by ROOM_TYPE
CREATE OR REPLACE FUNCTION kpi.drill_by_room_type(p_period text DEFAULT 'last_30')
RETURNS TABLE(
  room_type_id text, room_type_name text, rooms_in_type bigint,
  room_nights bigint, rooms_revenue numeric, adr numeric, occupancy_pct numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date; v_days int;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  v_days := (v_to - v_from + 1);
  
  RETURN QUERY
  WITH agg AS (
    SELECT 
      rt.room_type_id::text AS rt_id,
      rt.room_type_name AS rt_name,
      COUNT(DISTINCT r.room_id) AS rooms_count,
      COUNT(rr.id) AS rn,
      SUM(rr.rate) AS rev
    FROM public.reservation_rooms rr
    JOIN public.reservations res ON res.reservation_id = rr.reservation_id
    LEFT JOIN public.rooms r ON r.room_id = rr.room_id
    LEFT JOIN public.room_types rt ON rt.room_type_id = r.room_type_id
    WHERE rr.night_date BETWEEN v_from AND v_to
      AND NOT res.is_cancelled
      AND res.status NOT IN ('canceled','no_show')
      AND rr.rate > 0
    GROUP BY rt.room_type_id, rt.room_type_name
  )
  SELECT 
    a.rt_id,
    COALESCE(a.rt_name, '(uncategorized)'),
    a.rooms_count::bigint,
    a.rn::bigint,
    ROUND(a.rev::numeric, 2),
    ROUND((a.rev / NULLIF(a.rn, 0))::numeric, 2),
    ROUND(100.0 * a.rn / NULLIF(a.rooms_count * v_days, 0), 2)
  FROM agg a
  ORDER BY a.rev DESC;
END;
$func$;

-- DRILL: by COUNTRY
CREATE OR REPLACE FUNCTION kpi.drill_by_country(p_period text DEFAULT 'last_30')
RETURNS TABLE(
  country text, reservations bigint, guests bigint,
  room_nights bigint, rooms_revenue numeric, adr numeric,
  alos numeric, pct_of_revenue numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  RETURN QUERY
  WITH agg AS (
    SELECT 
      COALESCE(g.country, 'Unknown') AS ctry,
      COUNT(DISTINCT r.reservation_id) AS res,
      COUNT(DISTINCT r.guest_id) AS gst,
      COUNT(rr.id) AS rn,
      SUM(rr.rate) AS rev,
      AVG(r.check_out_date - r.check_in_date) AS alos_v
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    LEFT JOIN public.guests g ON g.guest_id = r.guest_id
    WHERE rr.night_date BETWEEN v_from AND v_to
      AND NOT r.is_cancelled
      AND r.status NOT IN ('canceled','no_show')
      AND rr.rate > 0
    GROUP BY 1
  ),
  total AS (SELECT SUM(rev) AS t FROM agg)
  SELECT 
    a.ctry, a.res::bigint, a.gst::bigint, a.rn::bigint,
    ROUND(a.rev::numeric, 2),
    ROUND((a.rev / NULLIF(a.rn, 0))::numeric, 2),
    ROUND(a.alos_v::numeric, 1),
    ROUND(100.0 * a.rev / NULLIF(t.t, 0), 2)
  FROM agg a CROSS JOIN total t
  ORDER BY a.rev DESC;
END;
$func$;

-- DRILL: by DOW
CREATE OR REPLACE FUNCTION kpi.drill_by_dow(p_period text DEFAULT 'last_90')
RETURNS TABLE(
  dow int, dow_name text, days_in_period bigint,
  avg_occupancy_pct numeric, avg_adr numeric, avg_revpar numeric, total_rooms_revenue numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  RETURN QUERY
  SELECT 
    EXTRACT(DOW FROM metric_date)::int,
    trim(to_char(metric_date, 'Day')),
    COUNT(*)::bigint,
    ROUND(AVG(occupancy_pct)::numeric, 2),
    ROUND(AVG(NULLIF(adr, 0))::numeric, 2),
    ROUND(AVG(revpar)::numeric, 2),
    ROUND(SUM(rooms_revenue)::numeric, 2)
  FROM public.daily_metrics
  WHERE metric_date BETWEEN v_from AND v_to
    AND is_actual = true
  GROUP BY EXTRACT(DOW FROM metric_date), trim(to_char(metric_date, 'Day'))
  ORDER BY EXTRACT(DOW FROM metric_date);
END;
$func$;

-- DRILL: by SEGMENT
CREATE OR REPLACE FUNCTION kpi.drill_by_segment(p_period text DEFAULT 'last_30')
RETURNS TABLE(
  segment text, reservations bigint, room_nights bigint,
  rooms_revenue numeric, adr numeric, pct_of_revenue numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  RETURN QUERY
  WITH agg AS (
    SELECT 
      COALESCE(NULLIF(r.market_segment,''), 'Unsegmented') AS seg,
      COUNT(DISTINCT r.reservation_id) AS res,
      COUNT(rr.id) AS rn,
      SUM(rr.rate) AS rev
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE rr.night_date BETWEEN v_from AND v_to
      AND NOT r.is_cancelled
      AND r.status NOT IN ('canceled','no_show')
      AND rr.rate > 0
    GROUP BY 1
  ),
  total AS (SELECT SUM(rev) AS t FROM agg)
  SELECT 
    a.seg, a.res::bigint, a.rn::bigint,
    ROUND(a.rev::numeric, 2),
    ROUND((a.rev / NULLIF(a.rn, 0))::numeric, 2),
    ROUND(100.0 * a.rev / NULLIF(t.t, 0), 2)
  FROM agg a CROSS JOIN total t
  ORDER BY a.rev DESC;
END;
$func$;

-- DRILL: by LEAD TIME
CREATE OR REPLACE FUNCTION kpi.drill_by_lead_time(p_period text DEFAULT 'last_90')
RETURNS TABLE(
  lead_bucket text, bucket_order int, reservations bigint,
  room_nights bigint, rooms_revenue numeric, adr numeric, pct_of_reservations numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  RETURN QUERY
  WITH bucketed AS (
    SELECT 
      CASE 
        WHEN (r.check_in_date - r.booking_date::date) < 0  THEN '00_walkin_or_negative'
        WHEN (r.check_in_date - r.booking_date::date) < 7  THEN '01_under_7d'
        WHEN (r.check_in_date - r.booking_date::date) < 14 THEN '02_7_to_13d'
        WHEN (r.check_in_date - r.booking_date::date) < 30 THEN '03_14_to_29d'
        WHEN (r.check_in_date - r.booking_date::date) < 60 THEN '04_30_to_59d'
        WHEN (r.check_in_date - r.booking_date::date) < 90 THEN '05_60_to_89d'
        WHEN (r.check_in_date - r.booking_date::date) < 180 THEN '06_90_to_179d'
        ELSE '07_180d_plus'
      END AS bucket,
      r.reservation_id, rr.id AS rr_id, rr.rate
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.check_in_date BETWEEN v_from AND v_to
      AND NOT r.is_cancelled
      AND r.status NOT IN ('canceled','no_show')
      AND rr.rate > 0
      AND r.booking_date IS NOT NULL
  ),
  agg AS (
    SELECT bucket, COUNT(DISTINCT reservation_id) AS res, COUNT(rr_id) AS rn, SUM(rate) AS rev
    FROM bucketed GROUP BY bucket
  ),
  total AS (SELECT SUM(res) AS t FROM agg)
  SELECT 
    a.bucket, SUBSTRING(a.bucket FROM 1 FOR 2)::int,
    a.res::bigint, a.rn::bigint,
    ROUND(a.rev::numeric, 2),
    ROUND((a.rev / NULLIF(a.rn, 0))::numeric, 2),
    ROUND(100.0 * a.res / NULLIF(t.t, 0), 2)
  FROM agg a CROSS JOIN total t
  ORDER BY a.bucket;
END;
$func$;

-- DRILL: by LOS
CREATE OR REPLACE FUNCTION kpi.drill_by_los(p_period text DEFAULT 'last_90')
RETURNS TABLE(
  los_bucket text, bucket_order int, reservations bigint,
  room_nights bigint, rooms_revenue numeric, adr numeric, pct_of_reservations numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  RETURN QUERY
  WITH bucketed AS (
    SELECT 
      CASE 
        WHEN (r.check_out_date - r.check_in_date) <= 1 THEN '01_1_night'
        WHEN (r.check_out_date - r.check_in_date) <= 2 THEN '02_2_nights'
        WHEN (r.check_out_date - r.check_in_date) <= 3 THEN '03_3_nights'
        WHEN (r.check_out_date - r.check_in_date) <= 5 THEN '04_4_to_5_nights'
        WHEN (r.check_out_date - r.check_in_date) <= 7 THEN '05_6_to_7_nights'
        WHEN (r.check_out_date - r.check_in_date) <= 14 THEN '06_8_to_14_nights'
        WHEN (r.check_out_date - r.check_in_date) <= 30 THEN '07_15_to_30_nights'
        ELSE '08_30_plus_nights'
      END AS bucket,
      r.reservation_id, rr.id AS rr_id, rr.rate
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.check_in_date BETWEEN v_from AND v_to
      AND NOT r.is_cancelled
      AND r.status NOT IN ('canceled','no_show')
      AND rr.rate > 0
  ),
  agg AS (
    SELECT bucket, COUNT(DISTINCT reservation_id) AS res, COUNT(rr_id) AS rn, SUM(rate) AS rev
    FROM bucketed GROUP BY bucket
  ),
  total AS (SELECT SUM(res) AS t FROM agg)
  SELECT 
    a.bucket, SUBSTRING(a.bucket FROM 1 FOR 2)::int,
    a.res::bigint, a.rn::bigint,
    ROUND(a.rev::numeric, 2),
    ROUND((a.rev / NULLIF(a.rn, 0))::numeric, 2),
    ROUND(100.0 * a.res / NULLIF(t.t, 0), 2)
  FROM agg a CROSS JOIN total t
  ORDER BY a.bucket;
END;
$func$;

-- DRILL: timeseries
CREATE OR REPLACE FUNCTION kpi.drill_timeseries(p_period text DEFAULT 'last_30', p_granularity text DEFAULT 'day')
RETURNS TABLE(
  bucket_date date, rooms_sold bigint, rooms_available bigint,
  occupancy_pct numeric, adr numeric, revpar numeric,
  rooms_revenue numeric, fb_revenue numeric, other_revenue numeric, total_revenue numeric,
  arrivals bigint, departures bigint, cancellations bigint
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date; v_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  IF p_granularity = 'week' THEN
    RETURN QUERY
    SELECT 
      date_trunc('week', metric_date)::date,
      SUM(rooms_sold)::bigint, SUM(rooms_available)::bigint,
      ROUND(AVG(occupancy_pct)::numeric, 2),
      ROUND(AVG(NULLIF(adr,0))::numeric, 2),
      ROUND(AVG(revpar)::numeric, 2),
      ROUND(SUM(rooms_revenue)::numeric, 2),
      ROUND(SUM(fb_revenue)::numeric, 2),
      ROUND(SUM(other_revenue)::numeric, 2),
      ROUND(SUM(total_revenue)::numeric, 2),
      SUM(arrivals)::bigint, SUM(departures)::bigint, SUM(cancellations)::bigint
    FROM public.daily_metrics
    WHERE metric_date BETWEEN v_from AND v_to
    GROUP BY 1 ORDER BY 1;
  ELSIF p_granularity = 'month' THEN
    RETURN QUERY
    SELECT 
      date_trunc('month', metric_date)::date,
      SUM(rooms_sold)::bigint, SUM(rooms_available)::bigint,
      ROUND(AVG(occupancy_pct)::numeric, 2),
      ROUND(AVG(NULLIF(adr,0))::numeric, 2),
      ROUND(AVG(revpar)::numeric, 2),
      ROUND(SUM(rooms_revenue)::numeric, 2),
      ROUND(SUM(fb_revenue)::numeric, 2),
      ROUND(SUM(other_revenue)::numeric, 2),
      ROUND(SUM(total_revenue)::numeric, 2),
      SUM(arrivals)::bigint, SUM(departures)::bigint, SUM(cancellations)::bigint
    FROM public.daily_metrics
    WHERE metric_date BETWEEN v_from AND v_to
    GROUP BY 1 ORDER BY 1;
  ELSE
    RETURN QUERY
    SELECT 
      metric_date, rooms_sold::bigint, rooms_available::bigint,
      occupancy_pct, adr, revpar,
      rooms_revenue, fb_revenue, other_revenue, total_revenue,
      arrivals::bigint, departures::bigint, cancellations::bigint
    FROM public.daily_metrics
    WHERE metric_date BETWEEN v_from AND v_to
    ORDER BY metric_date;
  END IF;
END;
$func$;