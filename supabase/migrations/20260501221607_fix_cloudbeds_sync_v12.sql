-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501221607
-- Name:    fix_cloudbeds_sync_v12
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- Fix 1: Backfill cb_guest_id for the 3 reservations missing it
-- =====================================================================
UPDATE public.reservations
SET cb_guest_id = raw->>'guestID'
WHERE cb_guest_id IS NULL
  AND raw->>'guestID' IS NOT NULL;

-- =====================================================================
-- Fix 2: recompute_daily_metrics — UPSERT instead of DELETE+INSERT
--        Eliminates the duplicate-key race when the cron fires twice.
-- =====================================================================
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
  arrivals AS (
    SELECT check_in_date AS d, COUNT(*) AS n FROM reservations
    WHERE NOT is_cancelled AND check_in_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_in_date
  ),
  departures AS (
    SELECT check_out_date AS d, COUNT(*) AS n FROM reservations
    WHERE NOT is_cancelled AND check_out_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_out_date
  ),
  cancellations AS (
    SELECT cancellation_date::date AS d, COUNT(*) AS n FROM reservations
    WHERE is_cancelled AND cancellation_date::date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY cancellation_date::date
  ),
  no_shows AS (
    SELECT check_in_date AS d, COUNT(*) AS n FROM reservations
    WHERE status = 'no_show' AND check_in_date BETWEEN p_from AND date_to AND property_id = p_property_id
    GROUP BY check_in_date
  ),
  fb AS (
    SELECT service_date AS d, SUM(amount) AS rev FROM transactions
    WHERE service_date BETWEEN p_from AND date_to
      AND transaction_type = 'debit' AND usali_dept = 'F&B'
    GROUP BY service_date
  ),
  other_rev AS (
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
    ROUND(COALESCE(o.rev, 0)::numeric, 2),
    ROUND((COALESCE(na.rooms_revenue, 0) + COALESCE(fb.rev, 0) + COALESCE(o.rev, 0))::numeric, 2),
    COALESCE(a.n, 0), COALESCE(d.n, 0),
    GREATEST(COALESCE(na.rooms_sold,0) - COALESCE(a.n,0) - COALESCE(d.n,0), 0),
    COALESCE(c.n, 0), COALESCE(ns.n, 0),
    ds.metric_date < CURRENT_DATE, now()
  FROM date_series ds
  LEFT JOIN night_actual na ON na.night_date = ds.metric_date
  LEFT JOIN arrivals a      ON a.d = ds.metric_date
  LEFT JOIN departures dep  ON dep.d = ds.metric_date
  LEFT JOIN cancellations c ON c.d = ds.metric_date
  LEFT JOIN no_shows ns     ON ns.d = ds.metric_date
  LEFT JOIN fb              ON fb.d = ds.metric_date
  LEFT JOIN other_rev o     ON o.d = ds.metric_date
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

-- =====================================================================
-- Fix 3: cb_sync_recent_reservations
--        - Save cb_guest_id (was missing — breaks guest portal links)
--        - Use cancellationDate (correct field name)
--        - Longer pg_sleep + retry loop with response polling
--        - Better error reporting
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cb_sync_recent_reservations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  rid bigint;
  total int;
  pages int;
  resp jsonb;
  res jsonb;
  rm jsonb;
  rate_date text;
  rate_amt numeric;
  res_count int := 0;
  rm_count int := 0;
  err_count int := 0;
  i int;
  base_url text;
  poll_attempt int;
  poll_max int := 12; -- 12 polls × 1s = 12s ceiling per page
BEGIN
  base_url := 'https://hotels.cloudbeds.com/api/v1.2/getReservationsWithRateDetails?propertyID=260955&includeGuestsDetails=true'
              || '&modifiedFrom=' || (CURRENT_DATE - 7)::text
              || '&modifiedTo=' || (CURRENT_DATE + 1)::text;

  -- First call: get total. Poll the response table up to 12s.
  SELECT net.http_get(url := base_url || '&pageNumber=1&pageSize=100',
                     headers := cb_auth_header()) INTO rid;
  resp := NULL;
  FOR poll_attempt IN 1..poll_max LOOP
    PERFORM pg_sleep(1);
    SELECT content::jsonb INTO resp FROM net._http_response WHERE id = rid;
    EXIT WHEN resp IS NOT NULL;
  END LOOP;

  IF resp IS NULL THEN
    INSERT INTO sync_runs(entity, status, error_message, finished_at)
    VALUES('reservations_incremental','error','first call timed out after 12s',now());
    RETURN jsonb_build_object('error','first call timed out');
  END IF;
  IF resp->>'success' = 'false' THEN
    INSERT INTO sync_runs(entity, status, error_message, finished_at, metadata)
    VALUES('reservations_incremental','error', resp->>'message', now(), resp);
    RETURN jsonb_build_object('error', resp->>'message');
  END IF;

  total := COALESCE((resp->>'total')::int, 0);
  IF total = 0 THEN
    INSERT INTO sync_runs(entity, status, rows_upserted, finished_at)
    VALUES('reservations_incremental','success',0,now());
    RETURN jsonb_build_object('total',0,'message','no recent changes');
  END IF;
  pages := CEIL(total::numeric / 100);

  -- Process page 1
  FOR res IN SELECT jsonb_array_elements(resp->'data') LOOP
    BEGIN
      INSERT INTO reservations(
        reservation_id, property_id, status, source, source_name,
        guest_name, guest_email, guest_country, cb_guest_id,
        check_in_date, check_out_date, nights,
        adults, children, total_amount, paid_amount, balance, currency,
        booking_date, cancellation_date, market_segment, rate_plan, room_type_name,
        raw, synced_at
      )
      SELECT
        res->>'reservationID',
        (res->>'propertyID')::bigint,
        res->>'status',
        res->'source'->>'sourceID',
        COALESCE(res->>'sourceName', res->'source'->>'name'),
        res->>'guestName',
        NULLIF(res->>'guestEmail',''),
        NULLIF(res->>'guestCountry',''),
        NULLIF(res->>'guestID','')::text,
        (SELECT MIN((r->>'roomCheckIn')::date)  FROM jsonb_array_elements(res->'rooms') r),
        (SELECT MAX((r->>'roomCheckOut')::date) FROM jsonb_array_elements(res->'rooms') r),
        (SELECT MAX((r->>'roomCheckOut')::date) - MIN((r->>'roomCheckIn')::date)
           FROM jsonb_array_elements(res->'rooms') r),
        (SELECT COALESCE(SUM((r->>'adults')::int),0)   FROM jsonb_array_elements(res->'rooms') r),
        (SELECT COALESCE(SUM((r->>'children')::int),0) FROM jsonb_array_elements(res->'rooms') r),
        (res->'balanceDetailed'->>'grandTotal')::numeric,
        (res->'balanceDetailed'->>'paid')::numeric,
        (res->>'balance')::numeric,
        res->>'propertyCurrency',
        NULLIF(res->>'dateCreated','')::timestamptz,
        COALESCE(NULLIF(res->>'cancellationDate','')::timestamptz,
                 NULLIF(res->>'dateCancelled','')::timestamptz),
        (res->'rooms'->0->>'marketName'),
        (res->'rooms'->0->>'ratePlanNamePublic'),
        (res->'rooms'->0->>'roomTypeName'),
        res, now()
      ON CONFLICT (reservation_id) DO UPDATE SET
        status = EXCLUDED.status,
        cb_guest_id = COALESCE(EXCLUDED.cb_guest_id, reservations.cb_guest_id),
        guest_email = COALESCE(EXCLUDED.guest_email, reservations.guest_email),
        total_amount = EXCLUDED.total_amount,
        paid_amount = EXCLUDED.paid_amount,
        balance = EXCLUDED.balance,
        cancellation_date = EXCLUDED.cancellation_date,
        raw = EXCLUDED.raw,
        synced_at = now(),
        updated_at = now();

      DELETE FROM reservation_rooms WHERE reservation_id = res->>'reservationID';
      FOR rm IN SELECT jsonb_array_elements(res->'rooms') LOOP
        IF jsonb_typeof(rm->'detailedRoomRates') = 'object' THEN
          FOR rate_date, rate_amt IN
            SELECT k, v::text::numeric FROM jsonb_each_text(rm->'detailedRoomRates') AS t(k, v)
          LOOP
            INSERT INTO reservation_rooms(reservation_id, room_type_id, room_id, night_date, rate, raw)
            VALUES(res->>'reservationID', NULLIF(rm->>'roomTypeID','')::bigint,
                   rm->>'roomID', rate_date::date, rate_amt, rm);
            rm_count := rm_count + 1;
          END LOOP;
        END IF;
      END LOOP;
      res_count := res_count + 1;
    EXCEPTION WHEN OTHERS THEN
      err_count := err_count + 1;
    END;
  END LOOP;

  -- Pages 2..N (same logic, polling response)
  IF pages > 1 THEN
    FOR i IN 2..pages LOOP
      SELECT net.http_get(url := base_url || '&pageNumber=' || i || '&pageSize=100',
                         headers := cb_auth_header()) INTO rid;
      resp := NULL;
      FOR poll_attempt IN 1..poll_max LOOP
        PERFORM pg_sleep(1);
        SELECT content::jsonb INTO resp FROM net._http_response WHERE id = rid;
        EXIT WHEN resp IS NOT NULL;
      END LOOP;
      IF resp IS NULL THEN
        err_count := err_count + 1;
        CONTINUE;
      END IF;

      FOR res IN SELECT jsonb_array_elements(resp->'data') LOOP
        BEGIN
          INSERT INTO reservations(
            reservation_id, property_id, status, source, source_name,
            guest_name, guest_email, guest_country, cb_guest_id,
            check_in_date, check_out_date, nights, adults, children,
            total_amount, paid_amount, balance, currency,
            booking_date, cancellation_date, market_segment, rate_plan, room_type_name,
            raw, synced_at
          )
          SELECT
            res->>'reservationID', (res->>'propertyID')::bigint, res->>'status',
            res->'source'->>'sourceID', COALESCE(res->>'sourceName', res->'source'->>'name'),
            res->>'guestName',
            NULLIF(res->>'guestEmail',''),
            NULLIF(res->>'guestCountry',''),
            NULLIF(res->>'guestID','')::text,
            (SELECT MIN((r->>'roomCheckIn')::date)  FROM jsonb_array_elements(res->'rooms') r),
            (SELECT MAX((r->>'roomCheckOut')::date) FROM jsonb_array_elements(res->'rooms') r),
            (SELECT MAX((r->>'roomCheckOut')::date) - MIN((r->>'roomCheckIn')::date)
               FROM jsonb_array_elements(res->'rooms') r),
            (SELECT COALESCE(SUM((r->>'adults')::int),0)   FROM jsonb_array_elements(res->'rooms') r),
            (SELECT COALESCE(SUM((r->>'children')::int),0) FROM jsonb_array_elements(res->'rooms') r),
            (res->'balanceDetailed'->>'grandTotal')::numeric,
            (res->'balanceDetailed'->>'paid')::numeric,
            (res->>'balance')::numeric,
            res->>'propertyCurrency',
            NULLIF(res->>'dateCreated','')::timestamptz,
            COALESCE(NULLIF(res->>'cancellationDate','')::timestamptz,
                     NULLIF(res->>'dateCancelled','')::timestamptz),
            (res->'rooms'->0->>'marketName'),
            (res->'rooms'->0->>'ratePlanNamePublic'),
            (res->'rooms'->0->>'roomTypeName'),
            res, now()
          ON CONFLICT (reservation_id) DO UPDATE SET
            status = EXCLUDED.status,
            cb_guest_id = COALESCE(EXCLUDED.cb_guest_id, reservations.cb_guest_id),
            guest_email = COALESCE(EXCLUDED.guest_email, reservations.guest_email),
            total_amount = EXCLUDED.total_amount,
            paid_amount = EXCLUDED.paid_amount,
            balance = EXCLUDED.balance,
            cancellation_date = EXCLUDED.cancellation_date,
            raw = EXCLUDED.raw,
            synced_at = now(),
            updated_at = now();

          DELETE FROM reservation_rooms WHERE reservation_id = res->>'reservationID';
          FOR rm IN SELECT jsonb_array_elements(res->'rooms') LOOP
            IF jsonb_typeof(rm->'detailedRoomRates') = 'object' THEN
              FOR rate_date, rate_amt IN
                SELECT k, v::text::numeric FROM jsonb_each_text(rm->'detailedRoomRates') AS t(k, v)
              LOOP
                INSERT INTO reservation_rooms(reservation_id, room_type_id, room_id, night_date, rate, raw)
                VALUES(res->>'reservationID', NULLIF(rm->>'roomTypeID','')::bigint,
                       rm->>'roomID', rate_date::date, rate_amt, rm);
                rm_count := rm_count + 1;
              END LOOP;
            END IF;
          END LOOP;
          res_count := res_count + 1;
        EXCEPTION WHEN OTHERS THEN
          err_count := err_count + 1;
        END;
      END LOOP;
    END LOOP;
  END IF;

  -- Update watermark
  INSERT INTO sync_watermarks(entity, last_synced_at)
  VALUES ('reservations_incremental', now())
  ON CONFLICT (entity) DO UPDATE SET last_synced_at = now();

  -- Log final run
  INSERT INTO sync_runs(entity, status, rows_upserted, rows_failed, finished_at, metadata)
  VALUES('reservations_incremental',
         CASE WHEN err_count > 0 THEN 'partial' ELSE 'success' END,
         res_count, err_count, now(),
         jsonb_build_object('pages',pages,'reservation_rooms',rm_count,'total',total));

  RETURN jsonb_build_object(
    'reservations', res_count,
    'reservation_rooms', rm_count,
    'pages', pages,
    'total', total,
    'errors', err_count
  );
END;
$function$;
