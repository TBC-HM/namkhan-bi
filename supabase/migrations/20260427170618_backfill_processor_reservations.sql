-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427170618
-- Name:    backfill_processor_reservations
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- Process collected pages -> reservations + reservation_rooms + guests
-- ============================================================================
CREATE OR REPLACE FUNCTION cb_process_reservations()
RETURNS TABLE(
  reservations_upserted int,
  reservation_rooms_upserted int,
  guests_upserted int,
  pages_processed int
) AS $$
DECLARE
  rec record;
  resp jsonb;
  res jsonb;
  rm jsonb;
  rate_date text;
  rate_amt numeric;
  res_count int := 0;
  rm_count int := 0;
  g_count int := 0;
  p_count int := 0;
BEGIN
  FOR rec IN
    SELECT q.id, q.request_id 
    FROM sync_request_queue q 
    WHERE q.entity = 'reservations_full' 
      AND q.status = 'received'
    ORDER BY q.page_number
  LOOP
    SELECT r.content::jsonb INTO resp FROM net._http_response r WHERE r.id = rec.request_id;
    
    -- Iterate reservations in this page
    FOR res IN SELECT jsonb_array_elements(resp->'data') LOOP
      -- Upsert reservation
      INSERT INTO reservations(
        reservation_id, property_id, status, source, source_name,
        guest_name, guest_email, guest_country,
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
        -- Earliest room check-in
        (SELECT MIN((r->>'roomCheckIn')::date) FROM jsonb_array_elements(res->'rooms') r),
        (SELECT MAX((r->>'roomCheckOut')::date) FROM jsonb_array_elements(res->'rooms') r),
        -- Nights as max - min
        (SELECT MAX((r->>'roomCheckOut')::date) - MIN((r->>'roomCheckIn')::date) FROM jsonb_array_elements(res->'rooms') r),
        (SELECT COALESCE(SUM((r->>'adults')::int), 0) FROM jsonb_array_elements(res->'rooms') r),
        (SELECT COALESCE(SUM((r->>'children')::int), 0) FROM jsonb_array_elements(res->'rooms') r),
        (res->'balanceDetailed'->>'grandTotal')::numeric,
        (res->'balanceDetailed'->>'paid')::numeric,
        (res->>'balance')::numeric,
        res->>'propertyCurrency',
        NULLIF(res->>'dateCreated','')::timestamptz,
        NULLIF(res->>'dateCancelled','')::timestamptz,
        -- Market segment from first room
        (res->'rooms'->0->>'marketName'),
        -- Rate plan from first room
        (res->'rooms'->0->>'ratePlanNamePublic'),
        -- Room type from first room
        (res->'rooms'->0->>'roomTypeName'),
        res,
        now()
      ON CONFLICT (reservation_id) DO UPDATE SET
        status = EXCLUDED.status,
        source = EXCLUDED.source,
        source_name = EXCLUDED.source_name,
        guest_name = EXCLUDED.guest_name,
        guest_email = EXCLUDED.guest_email,
        guest_country = EXCLUDED.guest_country,
        check_in_date = EXCLUDED.check_in_date,
        check_out_date = EXCLUDED.check_out_date,
        nights = EXCLUDED.nights,
        adults = EXCLUDED.adults,
        children = EXCLUDED.children,
        total_amount = EXCLUDED.total_amount,
        paid_amount = EXCLUDED.paid_amount,
        balance = EXCLUDED.balance,
        currency = EXCLUDED.currency,
        booking_date = EXCLUDED.booking_date,
        cancellation_date = EXCLUDED.cancellation_date,
        market_segment = EXCLUDED.market_segment,
        rate_plan = EXCLUDED.rate_plan,
        room_type_name = EXCLUDED.room_type_name,
        raw = EXCLUDED.raw,
        synced_at = now(),
        updated_at = now();
      res_count := res_count + 1;
      
      -- Delete existing reservation_rooms for this reservation, then re-insert
      DELETE FROM reservation_rooms WHERE reservation_id = res->>'reservationID';
      
      -- Iterate rooms within reservation
      FOR rm IN SELECT jsonb_array_elements(res->'rooms') LOOP
        -- Iterate detailedRoomRates (date -> rate map)
        IF jsonb_typeof(rm->'detailedRoomRates') = 'object' THEN
          FOR rate_date, rate_amt IN 
            SELECT k, v::text::numeric FROM jsonb_each_text(rm->'detailedRoomRates') AS t(k, v)
          LOOP
            INSERT INTO reservation_rooms(
              reservation_id, room_type_id, room_id, night_date, rate, raw
            ) VALUES (
              res->>'reservationID',
              NULLIF(rm->>'roomTypeID','')::bigint,
              rm->>'roomID',
              rate_date::date,
              rate_amt,
              rm
            );
            rm_count := rm_count + 1;
          END LOOP;
        END IF;
      END LOOP;
      
      -- Upsert guest
      IF (res->>'guestID') IS NOT NULL AND (res->>'guestID') <> '' THEN
        INSERT INTO guests(guest_id, property_id, first_name, last_name, country, raw, synced_at)
        VALUES(
          res->>'guestID',
          (res->>'propertyID')::bigint,
          split_part(res->>'guestName',' ',1),
          NULLIF(substring(res->>'guestName' from position(' ' in res->>'guestName')+1),''),
          NULLIF(res->>'guestCountry',''),
          jsonb_build_object('guestID', res->>'guestID', 'guestName', res->>'guestName', 'guestCountry', res->>'guestCountry'),
          now()
        )
        ON CONFLICT (guest_id) DO UPDATE SET
          country = COALESCE(EXCLUDED.country, guests.country),
          synced_at = now(),
          updated_at = now();
        g_count := g_count + 1;
      END IF;
    END LOOP;
    
    UPDATE sync_request_queue SET status = 'processed' WHERE id = rec.id;
    p_count := p_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT res_count, rm_count, g_count, p_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
