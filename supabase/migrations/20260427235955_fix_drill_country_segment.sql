-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427235955
-- Name:    fix_drill_country_segment
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Fix drill_by_country — use reservations.guest_country directly
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
      COALESCE(NULLIF(r.guest_country,''), 'Unknown') AS ctry,
      COUNT(DISTINCT r.reservation_id) AS res,
      COUNT(DISTINCT r.cb_guest_id) AS gst,
      COUNT(rr.id) AS rn,
      SUM(rr.rate) AS rev,
      AVG(r.check_out_date - r.check_in_date) AS alos_v
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
    a.ctry, a.res::bigint, a.gst::bigint, a.rn::bigint,
    ROUND(a.rev::numeric, 2),
    ROUND((a.rev / NULLIF(a.rn, 0))::numeric, 2),
    ROUND(a.alos_v::numeric, 1),
    ROUND(100.0 * a.rev / NULLIF(t.t, 0), 2)
  FROM agg a CROSS JOIN total t
  ORDER BY a.rev DESC;
END;
$func$;

-- Fix combo: country lookup uses reservations.guest_country (no guests join needed)
CREATE OR REPLACE FUNCTION kpi.drill_combo(
  p_period text DEFAULT 'last_30',
  p_dim1 text DEFAULT 'source',
  p_dim2 text DEFAULT 'none'
)
RETURNS TABLE(
  dim1 text, dim2 text,
  reservations bigint, room_nights bigint,
  rooms_revenue numeric, adr numeric, pct_of_total numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date;
  v_to date;
  v_d1_expr text;
  v_d2_expr text;
  v_sql text;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  
  v_d1_expr := CASE p_dim1
    WHEN 'source'    THEN E'COALESCE(s.name, r.source_name, \'Unknown\')'
    WHEN 'room'      THEN E'COALESCE(ro.room_name, rr.room_id, \'unassigned\')'
    WHEN 'room_type' THEN E'COALESCE(rt.room_type_name, \'uncategorized\')'
    WHEN 'country'   THEN E'COALESCE(NULLIF(r.guest_country,\'\'), \'Unknown\')'
    WHEN 'segment'   THEN E'COALESCE(NULLIF(r.market_segment,\'\'), \'Unsegmented\')'
    WHEN 'dow'       THEN E'trim(to_char(rr.night_date, \'Day\'))'
    WHEN 'month'     THEN E'to_char(rr.night_date, \'YYYY-MM\')'
    ELSE                  E'COALESCE(s.name, r.source_name, \'Unknown\')'
  END;
  
  v_d2_expr := CASE p_dim2
    WHEN 'source'    THEN E'COALESCE(s.name, r.source_name, \'Unknown\')'
    WHEN 'room'      THEN E'COALESCE(ro.room_name, rr.room_id, \'unassigned\')'
    WHEN 'room_type' THEN E'COALESCE(rt.room_type_name, \'uncategorized\')'
    WHEN 'country'   THEN E'COALESCE(NULLIF(r.guest_country,\'\'), \'Unknown\')'
    WHEN 'segment'   THEN E'COALESCE(NULLIF(r.market_segment,\'\'), \'Unsegmented\')'
    WHEN 'dow'       THEN E'trim(to_char(rr.night_date, \'Day\'))'
    WHEN 'month'     THEN E'to_char(rr.night_date, \'YYYY-MM\')'
    ELSE                  E'NULL::text'
  END;
  
  v_sql := format($q$
    WITH agg AS (
      SELECT 
        %s AS d1,
        %s AS d2,
        COUNT(DISTINCT r.reservation_id) AS res,
        COUNT(rr.id) AS rn,
        SUM(rr.rate) AS rev
      FROM public.reservations r
      JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
      LEFT JOIN public.sources s ON s.source_id = r.source
      LEFT JOIN public.rooms ro ON ro.room_id = rr.room_id
      LEFT JOIN public.room_types rt ON rt.room_type_id = ro.room_type_id
      WHERE rr.night_date BETWEEN $1 AND $2
        AND NOT r.is_cancelled
        AND r.status NOT IN ('canceled','no_show')
        AND rr.rate > 0
      GROUP BY 1, 2
    ),
    total AS (SELECT SUM(rev) AS t FROM agg)
    SELECT 
      a.d1::text,
      COALESCE(a.d2::text, '-'),
      a.res::bigint,
      a.rn::bigint,
      ROUND(a.rev::numeric, 2),
      ROUND((a.rev / NULLIF(a.rn, 0))::numeric, 2),
      ROUND(100.0 * a.rev / NULLIF(t.t, 0), 2)
    FROM agg a CROSS JOIN total t
    ORDER BY a.rev DESC NULLS LAST
    LIMIT 200
  $q$, v_d1_expr, v_d2_expr);
  
  RETURN QUERY EXECUTE v_sql USING v_from, v_to;
END;
$func$;