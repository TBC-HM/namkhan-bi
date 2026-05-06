-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502135410
-- Name:    fix_recompute_daily_metrics_alias
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION public.recompute_daily_metrics(
  p_property_id bigint,
  p_from date,
  p_to date DEFAULT NULL::date
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  upserted int;
  date_to date := COALESCE(p_to, CURRENT_DATE + 365);
  total_rooms int;
BEGIN
  SELECT COUNT(*) INTO total_rooms FROM (
    SELECT room_id FROM rooms WHERE property_id = p_property_id AND is_active
    UNION
    SELECT DISTINCT rr.room_id FROM reservation_rooms rr
    JOIN reservations r ON r.reservation_id = rr.reservation_id
    WHERE r.property_id = p_property_id AND rr.room_id IS NOT NULL
  ) x;
  IF total_rooms < 20 THEN total_rooms := 20; END IF;

  WITH date_series AS (
    SELECT generate_series(p_from, date_to, '1 day'::interval)::date AS metric_date
  ),
  night_actual AS (
    SELECT rr.night_date,
           COUNT(DISTINCT rr.reservation_id || '|' || COALESCE(rr.room_id,'')) AS rooms_sold,
           SUM(rr.rate) AS rooms_revenue
    FROM reservation_rooms rr
    JOIN reservations r ON r.reservation_id = rr.reservation_id
    WHERE NOT r.is_cancelled AND rr.night_date BETWEEN p_from AND date_to
    GROUP BY rr.night_date
  ),
  arrivals_cte AS (
    SELECT check_in_date AS d, COUNT(*) AS n FROM reservations
    WHERE NOT is_cancelled AND check_in_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_in_date
  ),
  departures_cte AS (
    SELECT check_out_date AS d, COUNT(*) AS n FROM reservations
    WHERE NOT is_cancelled AND check_out_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_out_date
  ),
  cancellations_cte AS (
    SELECT cancellation_date::date AS d, COUNT(*) AS n FROM reservations
    WHERE is_cancelled AND cancellation_date::date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY cancellation_date::date
  ),
  no_shows_cte AS (
    SELECT check_in_date AS d, COUNT(*) AS n FROM reservations
    WHERE status = 'no_show' AND check_in_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_in_date
  ),
  fb_cte AS (
    SELECT service_date AS d, SUM(amount) AS rev FROM transactions
    WHERE service_date BETWEEN p_from AND date_to
      AND transaction_type = 'debit' AND usali_dept = 'F&B'
    GROUP BY service_date
  ),
  other_rev_cte AS (
    SELECT service_date AS d, SUM(amount) AS rev FROM transactions
    WHERE service_date BETWEEN p_from AND date_to
      AND transaction_type = 'debit' AND usali_dept IN ('Other Operated','Retail','Misc Income')
    GROUP BY service_date
  )
  INSERT INTO daily_metrics(
    property_id, metric_date, rooms_available, rooms_sold,
    occupancy_pct, adr, revpar, rooms_revenue, fb_revenue, other_revenue, total_revenue,
    arrivals, departures, stayovers, cancellations, no_shows,
    is_actual, synced_at
  )
  SELECT
    p_property_id, ds.metric_date, total_rooms, COALESCE(na.rooms_sold, 0),
    ROUND(100.0 * COALESCE(na.rooms_sold, 0) / total_rooms, 2),
    ROUND(COALESCE(na.rooms_revenue / NULLIF(na.rooms_sold,0), 0)::numeric, 2),
    ROUND((COALESCE(na.rooms_revenue, 0) / total_rooms)::numeric, 2),
    ROUND(COALESCE(na.rooms_revenue, 0)::numeric, 2),
    ROUND(COALESCE(fb.rev, 0)::numeric, 2),
    ROUND(COALESCE(orev.rev, 0)::numeric, 2),
    ROUND((COALESCE(na.rooms_revenue, 0) + COALESCE(fb.rev, 0) + COALESCE(orev.rev, 0))::numeric, 2),
    COALESCE(a.n, 0),
    COALESCE(dep.n, 0),
    GREATEST(COALESCE(na.rooms_sold,0) - COALESCE(a.n,0) - COALESCE(dep.n,0), 0),
    COALESCE(c.n, 0),
    COALESCE(ns.n, 0),
    ds.metric_date < CURRENT_DATE,
    now()
  FROM date_series ds
  LEFT JOIN night_actual      na  ON na.night_date = ds.metric_date
  LEFT JOIN arrivals_cte      a   ON a.d   = ds.metric_date
  LEFT JOIN departures_cte    dep ON dep.d = ds.metric_date
  LEFT JOIN cancellations_cte c   ON c.d   = ds.metric_date
  LEFT JOIN no_shows_cte      ns  ON ns.d  = ds.metric_date
  LEFT JOIN fb_cte            fb  ON fb.d  = ds.metric_date
  LEFT JOIN other_rev_cte     orev ON orev.d = ds.metric_date
  ON CONFLICT (property_id, metric_date) DO UPDATE SET
    rooms_available = EXCLUDED.rooms_available,
    rooms_sold      = EXCLUDED.rooms_sold,
    occupancy_pct   = EXCLUDED.occupancy_pct,
    adr             = EXCLUDED.adr,
    revpar          = EXCLUDED.revpar,
    rooms_revenue   = EXCLUDED.rooms_revenue,
    fb_revenue      = EXCLUDED.fb_revenue,
    other_revenue   = EXCLUDED.other_revenue,
    total_revenue   = EXCLUDED.total_revenue,
    arrivals        = EXCLUDED.arrivals,
    departures      = EXCLUDED.departures,
    stayovers       = EXCLUDED.stayovers,
    cancellations   = EXCLUDED.cancellations,
    no_shows        = EXCLUDED.no_shows,
    is_actual       = EXCLUDED.is_actual,
    synced_at       = now();

  GET DIAGNOSTICS upserted = ROW_COUNT;
  RETURN upserted;
END;
$function$;
