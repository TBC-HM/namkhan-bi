-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427235816
-- Name:    build_drilldown_combo
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- COMBO DRILL: any 1 or 2 dimensions × period
-- Dims supported: 'source', 'room', 'room_type', 'country', 'segment', 'dow', 'month', 'none'
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
    WHEN 'country'   THEN E'COALESCE(g.country, \'Unknown\')'
    WHEN 'segment'   THEN E'COALESCE(NULLIF(r.market_segment,\'\'), \'Unsegmented\')'
    WHEN 'dow'       THEN E'trim(to_char(rr.night_date, \'Day\'))'
    WHEN 'month'     THEN E'to_char(rr.night_date, \'YYYY-MM\')'
    ELSE                  E'COALESCE(s.name, r.source_name, \'Unknown\')'
  END;
  
  v_d2_expr := CASE p_dim2
    WHEN 'source'    THEN E'COALESCE(s.name, r.source_name, \'Unknown\')'
    WHEN 'room'      THEN E'COALESCE(ro.room_name, rr.room_id, \'unassigned\')'
    WHEN 'room_type' THEN E'COALESCE(rt.room_type_name, \'uncategorized\')'
    WHEN 'country'   THEN E'COALESCE(g.country, \'Unknown\')'
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
      LEFT JOIN public.guests g ON g.guest_id = r.guest_id
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