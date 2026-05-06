-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427184107
-- Name:    kpi_period_helpers
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- MODULE 5: Period helpers, SDLY engine, single-metric reads
-- ============================================================

-- Single-metric read: any KPI for a date range
DROP FUNCTION IF EXISTS kpi.metric(text, date, date);
CREATE OR REPLACE FUNCTION kpi.metric(
  p_metric text,            -- 'occupancy_pct' | 'adr' | 'revpar' | 'rooms_revenue' | 'fb_revenue' | 'other_revenue' | 'total_revenue' | 'rooms_sold' | 'arrivals' | 'cancellations'
  p_from date DEFAULT (CURRENT_DATE - 30),
  p_to date DEFAULT (CURRENT_DATE - 1)
) RETURNS numeric AS $$
DECLARE result numeric;
BEGIN
  CASE p_metric
    WHEN 'occupancy_pct' THEN
      SELECT ROUND((100.0 * SUM(rooms_sold) / NULLIF(SUM(rooms_available),0))::numeric, 1) INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'adr' THEN
      SELECT ROUND((SUM(rooms_revenue) / NULLIF(SUM(rooms_sold),0))::numeric, 0) INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'revpar' THEN
      SELECT ROUND((SUM(rooms_revenue) / NULLIF(SUM(rooms_available),0))::numeric, 0) INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'trevpar' THEN
      SELECT ROUND((SUM(total_revenue) / NULLIF(SUM(rooms_available),0))::numeric, 0) INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'rooms_revenue' THEN
      SELECT ROUND(SUM(rooms_revenue)::numeric, 0) INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'fb_revenue' THEN
      SELECT ROUND(SUM(fb_revenue)::numeric, 0) INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'other_revenue' THEN
      SELECT ROUND(SUM(other_revenue)::numeric, 0) INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'total_revenue' THEN
      SELECT ROUND(SUM(total_revenue)::numeric, 0) INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'rooms_sold' THEN
      SELECT SUM(rooms_sold)::numeric INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'arrivals' THEN
      SELECT SUM(arrivals)::numeric INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'cancellations' THEN
      SELECT SUM(cancellations)::numeric INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'no_shows' THEN
      SELECT SUM(no_shows)::numeric INTO result
      FROM daily_metrics WHERE metric_date BETWEEN p_from AND p_to AND property_id = 260955;
    WHEN 'alos' THEN
      SELECT ROUND(AVG(nights)::numeric, 1) INTO result
      FROM reservations WHERE NOT is_cancelled AND check_in_date BETWEEN p_from AND p_to;
    WHEN 'lead_time' THEN
      SELECT ROUND(AVG(check_in_date - booking_date::date)::numeric, 0) INTO result
      FROM reservations WHERE NOT is_cancelled AND check_in_date BETWEEN p_from AND p_to AND booking_date IS NOT NULL;
    ELSE
      RAISE EXCEPTION 'Unknown metric: %', p_metric;
  END CASE;
  RETURN COALESCE(result, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Compare metric: current period vs lagged period (SDLY/STLY/etc)
DROP FUNCTION IF EXISTS kpi.metric_compare(text, date, date, int);
CREATE OR REPLACE FUNCTION kpi.metric_compare(
  p_metric text,
  p_from date DEFAULT (CURRENT_DATE - 30),
  p_to date DEFAULT (CURRENT_DATE - 1),
  p_lag_days int DEFAULT 365
) RETURNS TABLE(
  metric text, period_from date, period_to date,
  current_value numeric, prior_value numeric,
  delta_abs numeric, delta_pct numeric
) AS $$
DECLARE
  cur numeric;
  prv numeric;
BEGIN
  cur := kpi.metric(p_metric, p_from, p_to);
  prv := kpi.metric(p_metric, p_from - p_lag_days, p_to - p_lag_days);
  
  RETURN QUERY SELECT 
    p_metric, p_from, p_to,
    cur, prv,
    ROUND((cur - prv)::numeric, 2),
    CASE WHEN prv = 0 THEN NULL 
         ELSE ROUND((100.0 * (cur - prv) / prv)::numeric, 1) END;
END;
$$ LANGUAGE plpgsql STABLE;

-- One-shot pace report: snapshot current/prior/SDLY for any metric
CREATE OR REPLACE FUNCTION kpi.metric_pace(
  p_metric text,
  p_from date DEFAULT (CURRENT_DATE - 30),
  p_to date DEFAULT (CURRENT_DATE - 1)
) RETURNS TABLE(
  metric text, 
  current_period numeric,
  prior_7d numeric, delta_7d_pct numeric,
  prior_30d numeric, delta_30d_pct numeric,
  sdly_365d numeric, delta_sdly_pct numeric
) AS $$
DECLARE
  cur numeric;
  p7 numeric; p30 numeric; p365 numeric;
BEGIN
  cur := kpi.metric(p_metric, p_from, p_to);
  p7  := kpi.metric(p_metric, p_from - 7, p_to - 7);
  p30 := kpi.metric(p_metric, p_from - 30, p_to - 30);
  p365 := kpi.metric(p_metric, p_from - 365, p_to - 365);
  
  RETURN QUERY SELECT 
    p_metric, cur,
    p7,  CASE WHEN p7=0 THEN NULL ELSE ROUND((100.0*(cur-p7)/p7)::numeric, 1) END,
    p30, CASE WHEN p30=0 THEN NULL ELSE ROUND((100.0*(cur-p30)/p30)::numeric, 1) END,
    p365, CASE WHEN p365=0 THEN NULL ELSE ROUND((100.0*(cur-p365)/p365)::numeric, 1) END;
END;
$$ LANGUAGE plpgsql STABLE;

-- KPI dashboard snapshot: all top metrics for a period
CREATE OR REPLACE FUNCTION kpi.snapshot(
  p_from date DEFAULT (CURRENT_DATE - 30),
  p_to date DEFAULT (CURRENT_DATE - 1)
) RETURNS TABLE(
  metric text, value numeric, sdly numeric, sdly_delta_pct numeric
) AS $$
  SELECT m AS metric,
         kpi.metric(m, p_from, p_to) AS value,
         kpi.metric(m, p_from - 365, p_to - 365) AS sdly,
         CASE WHEN kpi.metric(m, p_from - 365, p_to - 365) = 0 THEN NULL
              ELSE ROUND((100.0 * (kpi.metric(m, p_from, p_to) - kpi.metric(m, p_from - 365, p_to - 365)) 
                          / kpi.metric(m, p_from - 365, p_to - 365))::numeric, 1) END AS sdly_delta_pct
  FROM unnest(ARRAY['occupancy_pct','adr','revpar','trevpar','rooms_revenue','fb_revenue','other_revenue','total_revenue','rooms_sold','arrivals','cancellations','alos','lead_time']) AS m;
$$ LANGUAGE sql STABLE;

-- Dimensional metric: same KPI sliced by source/country/room_type/segment
DROP FUNCTION IF EXISTS kpi.metric_by_dim(text, date, date, text, int);
CREATE OR REPLACE FUNCTION kpi.metric_by_dim(
  p_metric text,                            -- 'rooms_revenue' | 'rooms_sold' | 'adr'
  p_from date DEFAULT (CURRENT_DATE - 30),
  p_to date DEFAULT (CURRENT_DATE - 1),
  p_dim text DEFAULT 'source',              -- 'source' | 'country' | 'room_type' | 'segment'
  p_limit int DEFAULT 25
) RETURNS TABLE(
  dim_value text, room_nights bigint, revenue numeric, adr numeric
) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT 
       COALESCE(NULLIF(%I,''''), ''(blank)'')::text AS dim_value,
       COUNT(*)::bigint AS room_nights,
       ROUND(SUM(rr.rate)::numeric, 0) AS revenue,
       ROUND((SUM(rr.rate) / NULLIF(COUNT(*),0))::numeric, 0) AS adr
     FROM reservation_rooms rr
     JOIN reservations r ON r.reservation_id = rr.reservation_id
     WHERE NOT r.is_cancelled
       AND rr.night_date BETWEEN %L AND %L
     GROUP BY 1
     ORDER BY 3 DESC NULLS LAST
     LIMIT %s',
    CASE p_dim 
      WHEN 'source' THEN 'source_name'
      WHEN 'country' THEN 'guest_country'
      WHEN 'room_type' THEN 'room_type_name'
      WHEN 'segment' THEN 'market_segment'
      ELSE 'source_name'
    END,
    p_from, p_to, p_limit
  );
END;
$$ LANGUAGE plpgsql STABLE;
