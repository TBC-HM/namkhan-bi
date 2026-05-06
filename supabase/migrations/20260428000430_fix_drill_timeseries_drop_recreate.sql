-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428000430
-- Name:    fix_drill_timeseries_drop_recreate
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP FUNCTION IF EXISTS kpi.drill_timeseries(text, text);

CREATE FUNCTION kpi.drill_timeseries(p_period text DEFAULT 'last_30', p_granularity text DEFAULT 'day')
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
      date_trunc('week', dm.metric_date)::date,
      SUM(dm.rooms_sold)::bigint, SUM(dm.rooms_available)::bigint,
      ROUND(AVG(dm.occupancy_pct)::numeric, 2),
      ROUND(AVG(NULLIF(dm.adr,0))::numeric, 2),
      ROUND(AVG(dm.revpar)::numeric, 2),
      ROUND(SUM(dm.rooms_revenue)::numeric, 2),
      ROUND(SUM(dm.fb_revenue)::numeric, 2),
      ROUND(SUM(dm.other_revenue)::numeric, 2),
      ROUND(SUM(dm.total_revenue)::numeric, 2),
      SUM(dm.arrivals)::bigint, SUM(dm.departures)::bigint, SUM(dm.cancellations)::bigint
    FROM public.daily_metrics dm
    WHERE dm.metric_date BETWEEN v_from AND v_to
    GROUP BY 1 ORDER BY 1;
  ELSIF p_granularity = 'month' THEN
    RETURN QUERY
    SELECT 
      date_trunc('month', dm.metric_date)::date,
      SUM(dm.rooms_sold)::bigint, SUM(dm.rooms_available)::bigint,
      ROUND(AVG(dm.occupancy_pct)::numeric, 2),
      ROUND(AVG(NULLIF(dm.adr,0))::numeric, 2),
      ROUND(AVG(dm.revpar)::numeric, 2),
      ROUND(SUM(dm.rooms_revenue)::numeric, 2),
      ROUND(SUM(dm.fb_revenue)::numeric, 2),
      ROUND(SUM(dm.other_revenue)::numeric, 2),
      ROUND(SUM(dm.total_revenue)::numeric, 2),
      SUM(dm.arrivals)::bigint, SUM(dm.departures)::bigint, SUM(dm.cancellations)::bigint
    FROM public.daily_metrics dm
    WHERE dm.metric_date BETWEEN v_from AND v_to
    GROUP BY 1 ORDER BY 1;
  ELSE
    RETURN QUERY
    SELECT 
      dm.metric_date, dm.rooms_sold::bigint, dm.rooms_available::bigint,
      dm.occupancy_pct, dm.adr, dm.revpar,
      dm.rooms_revenue, dm.fb_revenue, dm.other_revenue, dm.total_revenue,
      dm.arrivals::bigint, dm.departures::bigint, dm.cancellations::bigint
    FROM public.daily_metrics dm
    WHERE dm.metric_date BETWEEN v_from AND v_to
    ORDER BY dm.metric_date;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION kpi.drill_timeseries(text, text) TO anon, authenticated;