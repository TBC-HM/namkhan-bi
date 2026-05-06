-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427173406
-- Name:    recompute_daily_metrics
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION recompute_daily_metrics(
  p_property_id bigint DEFAULT 260955,
  p_from date DEFAULT '2025-01-01',
  p_to date DEFAULT NULL
) RETURNS int AS $$
DECLARE
  upserted int;
  date_to date := COALESCE(p_to, CURRENT_DATE + 365);
  total_rooms int;
BEGIN
  -- Total bookable rooms (current inventory)
  SELECT COUNT(*) INTO total_rooms FROM rooms WHERE property_id = p_property_id AND is_active;
  IF total_rooms IS NULL OR total_rooms = 0 THEN total_rooms := 20; END IF;
  
  -- Wipe + recompute the range
  DELETE FROM daily_metrics 
  WHERE property_id = p_property_id AND metric_date BETWEEN p_from AND date_to;
  
  WITH date_series AS (
    SELECT generate_series(p_from, date_to, '1 day'::interval)::date AS metric_date
  ),
  -- Per-night actuals from reservation_rooms (only non-cancelled)
  night_actual AS (
    SELECT 
      rr.night_date,
      COUNT(DISTINCT rr.reservation_id || '|' || COALESCE(rr.room_id,'')) AS rooms_sold,
      SUM(rr.rate) AS rooms_revenue
    FROM reservation_rooms rr
    JOIN reservations r ON r.reservation_id = rr.reservation_id
    WHERE NOT r.is_cancelled 
      AND rr.night_date BETWEEN p_from AND date_to
    GROUP BY rr.night_date
  ),
  -- Arrivals/departures by reservation date
  arrivals AS (
    SELECT check_in_date AS d, COUNT(*) AS n
    FROM reservations 
    WHERE NOT is_cancelled AND check_in_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_in_date
  ),
  departures AS (
    SELECT check_out_date AS d, COUNT(*) AS n
    FROM reservations 
    WHERE NOT is_cancelled AND check_out_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_out_date
  ),
  cancellations AS (
    SELECT cancellation_date::date AS d, COUNT(*) AS n
    FROM reservations 
    WHERE is_cancelled AND cancellation_date::date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY cancellation_date::date
  ),
  no_shows AS (
    SELECT check_in_date AS d, COUNT(*) AS n
    FROM reservations 
    WHERE status = 'no_show' AND check_in_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_in_date
  ),
  fb AS (
    -- F&B revenue from transactions where item_category_name suggests F&B
    SELECT service_date AS d, SUM(amount) AS rev
    FROM transactions
    WHERE service_date BETWEEN p_from AND date_to
      AND transaction_type = 'debit'
      AND (item_category_name ILIKE '%food%' OR item_category_name ILIKE '%bever%' 
           OR item_category_name ILIKE '%drink%' OR item_category_name ILIKE '%bar%' 
           OR item_category_name ILIKE '%kitchen%' OR item_category_name ILIKE '%juice%'
           OR item_category_name ILIKE '%wine%' OR item_category_name ILIKE '%beer%')
    GROUP BY service_date
  ),
  other_rev AS (
    SELECT service_date AS d, SUM(amount) AS rev
    FROM transactions
    WHERE service_date BETWEEN p_from AND date_to
      AND transaction_type = 'debit'
      AND (item_category_name IS NOT NULL)
      AND NOT (item_category_name ILIKE '%food%' OR item_category_name ILIKE '%bever%' 
               OR item_category_name ILIKE '%drink%' OR item_category_name ILIKE '%bar%' 
               OR item_category_name ILIKE '%kitchen%' OR item_category_name ILIKE '%juice%'
               OR item_category_name ILIKE '%wine%' OR item_category_name ILIKE '%beer%'
               OR item_category_name ILIKE '%room%' OR item_category_name ILIKE '%accom%')
    GROUP BY service_date
  )
  INSERT INTO daily_metrics(
    property_id, metric_date, rooms_available, rooms_sold,
    occupancy_pct, adr, revpar, rooms_revenue, fb_revenue, other_revenue, total_revenue,
    arrivals, departures, stayovers, cancellations, no_shows,
    is_actual, synced_at
  )
  SELECT 
    p_property_id,
    ds.metric_date,
    total_rooms,
    COALESCE(na.rooms_sold, 0),
    ROUND(100.0 * COALESCE(na.rooms_sold, 0) / total_rooms, 2),
    ROUND(COALESCE(na.rooms_revenue / NULLIF(na.rooms_sold,0), 0)::numeric, 2),
    ROUND((COALESCE(na.rooms_revenue, 0) / total_rooms)::numeric, 2),
    ROUND(COALESCE(na.rooms_revenue, 0)::numeric, 2),
    ROUND(COALESCE(fb.rev, 0)::numeric, 2),
    ROUND(COALESCE(o.rev, 0)::numeric, 2),
    ROUND((COALESCE(na.rooms_revenue, 0) + COALESCE(fb.rev, 0) + COALESCE(o.rev, 0))::numeric, 2),
    COALESCE(a.n, 0),
    COALESCE(d.n, 0),
    GREATEST(COALESCE(na.rooms_sold,0) - COALESCE(a.n,0) - COALESCE(d.n,0), 0),
    COALESCE(c.n, 0),
    COALESCE(ns.n, 0),
    ds.metric_date < CURRENT_DATE,
    now()
  FROM date_series ds
  LEFT JOIN night_actual na ON na.night_date = ds.metric_date
  LEFT JOIN arrivals a ON a.d = ds.metric_date
  LEFT JOIN departures d ON d.d = ds.metric_date
  LEFT JOIN cancellations c ON c.d = ds.metric_date
  LEFT JOIN no_shows ns ON ns.d = ds.metric_date
  LEFT JOIN fb ON fb.d = ds.metric_date
  LEFT JOIN other_rev o ON o.d = ds.metric_date;
  
  GET DIAGNOSTICS upserted = ROW_COUNT;
  RETURN upserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT recompute_daily_metrics(260955, '2025-01-01'::date, (CURRENT_DATE + 365)::date) AS days_computed;
