-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501222257
-- Name:    fix_cloudbeds_sync_v15_collect_response
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- v15: Use net._http_collect_response(async := false) which blocks properly
-- via net._await_response. Fixes the polling visibility issue.

CREATE OR REPLACE FUNCTION public.cb_sync_recent_reservations(p_days_back int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  rid bigint;
  collected net.http_response_result;
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
  http_timeout int := 60000; -- 60s pg_net timeout
BEGIN
  base_url := 'https://hotels.cloudbeds.com/api/v1.2/getReservationsWithRateDetails?propertyID=260955&includeGuestsDetails=true'
              || '&modifiedFrom=' || (CURRENT_DATE - p_days_back)::text
              || '&modifiedTo=' || (CURRENT_DATE + 1)::text;

  -- Page 1
  SELECT net.http_get(
    url := base_url || '&pageNumber=1&pageSize=100',
    headers := cb_auth_header(),
    timeout_milliseconds := http_timeout
  ) INTO rid;

  -- Block until response is available (or pg_net's timeout fires)
  SELECT * INTO collected FROM net._http_collect_response(rid, async := false);

  IF collected.status = 'ERROR' THEN
    INSERT INTO sync_runs(entity, status, error_message, finished_at, metadata)
    VALUES('reservations_incremental','failed',
           'pg_net: ' || COALESCE(collected.message,'unknown'), now(),
           jsonb_build_object('http_request_id', rid));
    RETURN jsonb_build_object('error','pg_net error','detail',collected.message);
  END IF;

  IF (collected.response).status_code >= 400 THEN
    INSERT INTO sync_runs(entity, status, error_message, finished_at, metadata)
    VALUES('reservations_incremental','failed',
           'http ' || (collected.response).status_code, now(),
           jsonb_build_object('http_request_id', rid, 'status', (collected.response).status_code));
    RETURN jsonb_build_object('error','http error','status',(collected.response).status_code);
  END IF;

  resp := (collected.response).body::jsonb;

  IF resp->>'success' = 'false' THEN
    INSERT INTO sync_runs(entity, status, error_message, finished_at, metadata)
    VALUES('reservations_incremental','failed', resp->>'message', now(), resp);
    RETURN jsonb_build_object('error', resp->>'message');
  END IF;

  total := COALESCE((resp->>'total')::int, 0);
  IF total = 0 THEN
    INSERT INTO sync_runs(entity, status, rows_upserted, finished_at)
    VALUES('reservations_incremental','success',0,now());
    INSERT INTO sync_watermarks(entity, last_synced_at)
    VALUES ('reservations_incremental', now())
    ON CONFLICT (entity) DO UPDATE SET last_synced_at = now();
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
        res->>'reservationID', (res->>'propertyID')::bigint, res->>'status',
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
    EXCEPTION WHEN OTHERS THEN err_count := err_count + 1; END;
  END LOOP;

  -- Pages 2..N
  IF pages > 1 THEN
    FOR i IN 2..pages LOOP
      SELECT net.http_get(
        url := base_url || '&pageNumber=' || i || '&pageSize=100',
        headers := cb_auth_header(),
        timeout_milliseconds := http_timeout
      ) INTO rid;
      SELECT * INTO collected FROM net._http_collect_response(rid, async := false);
      IF collected.status = 'ERROR' OR (collected.response).status_code >= 400 THEN
        err_count := err_count + 1;
        CONTINUE;
      END IF;
      resp := (collected.response).body::jsonb;

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
        EXCEPTION WHEN OTHERS THEN err_count := err_count + 1; END;
      END LOOP;
    END LOOP;
  END IF;

  INSERT INTO sync_watermarks(entity, last_synced_at)
  VALUES ('reservations_incremental', now())
  ON CONFLICT (entity) DO UPDATE SET last_synced_at = now();

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
