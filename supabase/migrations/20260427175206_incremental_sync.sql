-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427175206
-- Name:    incremental_sync
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ===========================================================================
-- INCREMENTAL SYNC: hourly cron pulls last 7 days of changes + recomputes KPIs
-- ===========================================================================

-- Pull recent reservations (modified in last 7 days)
CREATE OR REPLACE FUNCTION cb_sync_recent_reservations()
RETURNS jsonb AS $$
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
  i int;
  base_url text;
BEGIN
  base_url := 'https://hotels.cloudbeds.com/api/v1.2/getReservationsWithRateDetails?propertyID=260955&includeGuestsDetails=true'
              || '&modifiedFrom=' || (CURRENT_DATE - 7)::text
              || '&modifiedTo=' || (CURRENT_DATE + 1)::text;
  
  -- First call: get total
  SELECT net.http_get(url := base_url || '&pageNumber=1&pageSize=100', headers := cb_auth_header()) INTO rid;
  PERFORM pg_sleep(4);
  SELECT content::jsonb INTO resp FROM net._http_response WHERE id = rid;
  IF resp IS NULL THEN RETURN jsonb_build_object('error', 'first call timed out'); END IF;
  
  total := (resp->>'total')::int;
  IF total IS NULL OR total = 0 THEN
    RETURN jsonb_build_object('total', 0, 'message', 'no recent changes');
  END IF;
  
  pages := CEIL(total::numeric / 100);
  
  -- Process page 1
  FOR res IN SELECT jsonb_array_elements(resp->'data') LOOP
    INSERT INTO reservations(
      reservation_id, property_id, status, source, source_name,
      guest_name, guest_email, guest_country,
      check_in_date, check_out_date, nights,
      adults, children, total_amount, paid_amount, balance, currency,
      booking_date, cancellation_date, market_segment, rate_plan, room_type_name,
      raw, synced_at
    )
    SELECT
      res->>'reservationID', (res->>'propertyID')::bigint, res->>'status',
      res->'source'->>'sourceID', COALESCE(res->>'sourceName', res->'source'->>'name'),
      res->>'guestName', NULLIF(res->>'guestEmail',''), NULLIF(res->>'guestCountry',''),
      (SELECT MIN((r->>'roomCheckIn')::date) FROM jsonb_array_elements(res->'rooms') r),
      (SELECT MAX((r->>'roomCheckOut')::date) FROM jsonb_array_elements(res->'rooms') r),
      (SELECT MAX((r->>'roomCheckOut')::date) - MIN((r->>'roomCheckIn')::date) FROM jsonb_array_elements(res->'rooms') r),
      (SELECT COALESCE(SUM((r->>'adults')::int), 0) FROM jsonb_array_elements(res->'rooms') r),
      (SELECT COALESCE(SUM((r->>'children')::int), 0) FROM jsonb_array_elements(res->'rooms') r),
      (res->'balanceDetailed'->>'grandTotal')::numeric,
      (res->'balanceDetailed'->>'paid')::numeric,
      (res->>'balance')::numeric,
      res->>'propertyCurrency',
      NULLIF(res->>'dateCreated','')::timestamptz,
      NULLIF(res->>'dateCancelled','')::timestamptz,
      (res->'rooms'->0->>'marketName'),
      (res->'rooms'->0->>'ratePlanNamePublic'),
      (res->'rooms'->0->>'roomTypeName'),
      res, now()
    ON CONFLICT (reservation_id) DO UPDATE SET
      status = EXCLUDED.status, total_amount = EXCLUDED.total_amount,
      paid_amount = EXCLUDED.paid_amount, balance = EXCLUDED.balance,
      cancellation_date = EXCLUDED.cancellation_date, raw = EXCLUDED.raw,
      synced_at = now(), updated_at = now();
    
    DELETE FROM reservation_rooms WHERE reservation_id = res->>'reservationID';
    FOR rm IN SELECT jsonb_array_elements(res->'rooms') LOOP
      IF jsonb_typeof(rm->'detailedRoomRates') = 'object' THEN
        FOR rate_date, rate_amt IN 
          SELECT k, v::text::numeric FROM jsonb_each_text(rm->'detailedRoomRates') AS t(k, v)
        LOOP
          INSERT INTO reservation_rooms(reservation_id, room_type_id, room_id, night_date, rate, raw)
          VALUES(res->>'reservationID', NULLIF(rm->>'roomTypeID','')::bigint, rm->>'roomID', 
                 rate_date::date, rate_amt, rm);
          rm_count := rm_count + 1;
        END LOOP;
      END IF;
    END LOOP;
    res_count := res_count + 1;
  END LOOP;
  
  -- Pages 2..N
  IF pages > 1 THEN
    FOR i IN 2..pages LOOP
      SELECT net.http_get(url := base_url || '&pageNumber=' || i || '&pageSize=100', 
                         headers := cb_auth_header()) INTO rid;
      PERFORM pg_sleep(2);
      SELECT content::jsonb INTO resp FROM net._http_response WHERE id = rid;
      IF resp IS NULL THEN CONTINUE; END IF;
      FOR res IN SELECT jsonb_array_elements(resp->'data') LOOP
        INSERT INTO reservations(
          reservation_id, property_id, status, source, source_name,
          guest_name, guest_email, guest_country,
          check_in_date, check_out_date, nights, adults, children,
          total_amount, paid_amount, balance, currency,
          booking_date, cancellation_date, market_segment, rate_plan, room_type_name,
          raw, synced_at
        )
        SELECT
          res->>'reservationID', (res->>'propertyID')::bigint, res->>'status',
          res->'source'->>'sourceID', COALESCE(res->>'sourceName', res->'source'->>'name'),
          res->>'guestName', NULLIF(res->>'guestEmail',''), NULLIF(res->>'guestCountry',''),
          (SELECT MIN((r->>'roomCheckIn')::date) FROM jsonb_array_elements(res->'rooms') r),
          (SELECT MAX((r->>'roomCheckOut')::date) FROM jsonb_array_elements(res->'rooms') r),
          (SELECT MAX((r->>'roomCheckOut')::date) - MIN((r->>'roomCheckIn')::date) FROM jsonb_array_elements(res->'rooms') r),
          (SELECT COALESCE(SUM((r->>'adults')::int), 0) FROM jsonb_array_elements(res->'rooms') r),
          (SELECT COALESCE(SUM((r->>'children')::int), 0) FROM jsonb_array_elements(res->'rooms') r),
          (res->'balanceDetailed'->>'grandTotal')::numeric,
          (res->'balanceDetailed'->>'paid')::numeric,
          (res->>'balance')::numeric,
          res->>'propertyCurrency',
          NULLIF(res->>'dateCreated','')::timestamptz,
          NULLIF(res->>'dateCancelled','')::timestamptz,
          (res->'rooms'->0->>'marketName'),
          (res->'rooms'->0->>'ratePlanNamePublic'),
          (res->'rooms'->0->>'roomTypeName'),
          res, now()
        ON CONFLICT (reservation_id) DO UPDATE SET
          status = EXCLUDED.status, total_amount = EXCLUDED.total_amount,
          paid_amount = EXCLUDED.paid_amount, balance = EXCLUDED.balance,
          cancellation_date = EXCLUDED.cancellation_date, raw = EXCLUDED.raw,
          synced_at = now(), updated_at = now();
        DELETE FROM reservation_rooms WHERE reservation_id = res->>'reservationID';
        FOR rm IN SELECT jsonb_array_elements(res->'rooms') LOOP
          IF jsonb_typeof(rm->'detailedRoomRates') = 'object' THEN
            FOR rate_date, rate_amt IN 
              SELECT k, v::text::numeric FROM jsonb_each_text(rm->'detailedRoomRates') AS t(k, v)
            LOOP
              INSERT INTO reservation_rooms(reservation_id, room_type_id, room_id, night_date, rate, raw)
              VALUES(res->>'reservationID', NULLIF(rm->>'roomTypeID','')::bigint, rm->>'roomID', 
                     rate_date::date, rate_amt, rm);
              rm_count := rm_count + 1;
            END LOOP;
          END IF;
        END LOOP;
        res_count := res_count + 1;
      END LOOP;
    END LOOP;
  END IF;
  
  -- Log run
  INSERT INTO sync_runs(entity, status, rows_upserted, finished_at, metadata)
  VALUES('reservations_incremental', 'success', res_count, now(),
         jsonb_build_object('pages', pages, 'reservation_rooms', rm_count));
  
  RETURN jsonb_build_object('reservations', res_count, 'reservation_rooms', rm_count, 'pages', pages, 'total', total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron: hourly recompute of daily metrics
CREATE OR REPLACE FUNCTION cb_hourly_refresh()
RETURNS jsonb AS $$
DECLARE
  res_result jsonb;
  days_recomputed int;
BEGIN
  -- Pull recent changes
  SELECT cb_sync_recent_reservations() INTO res_result;
  
  -- Re-apply USALI on any new transactions
  WITH cat_map AS (
    SELECT 
      c.item_category_name,
      (SELECT m.usali_dept FROM usali_category_map m 
       WHERE m.is_active AND c.item_category_name ILIKE '%' || m.match_pattern || '%'
       ORDER BY m.priority, length(m.match_pattern) DESC LIMIT 1) AS dept,
      (SELECT m.usali_subdept FROM usali_category_map m 
       WHERE m.is_active AND c.item_category_name ILIKE '%' || m.match_pattern || '%'
       ORDER BY m.priority, length(m.match_pattern) DESC LIMIT 1) AS subdept
    FROM (SELECT DISTINCT item_category_name FROM transactions 
          WHERE item_category_name IS NOT NULL AND item_category_name <> '') c
  )
  UPDATE transactions t
  SET usali_dept = cm.dept, usali_subdept = cm.subdept
  FROM cat_map cm
  WHERE t.item_category_name = cm.item_category_name AND cm.dept IS NOT NULL
    AND t.usali_dept IS NULL;
  
  -- Recompute last 60 days actuals + next 365 OTB
  SELECT recompute_daily_metrics(260955, (CURRENT_DATE - 60)::date, (CURRENT_DATE + 365)::date) INTO days_recomputed;
  
  RETURN jsonb_build_object('reservations', res_result, 'days_recomputed', days_recomputed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule hourly
SELECT cron.schedule('hourly-refresh', '0 * * * *', $$ SELECT cb_hourly_refresh(); $$);
