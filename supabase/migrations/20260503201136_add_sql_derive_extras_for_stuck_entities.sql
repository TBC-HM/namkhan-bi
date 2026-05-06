-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503201136
-- Name:    add_sql_derive_extras_for_stuck_entities
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- SQL-side derive functions for entities the sync-cloudbeds Edge Function
-- doesn't refresh reliably:
--   * guests             — EF has no syncGuests; derive from reservations cols
--   * sources            — EF has no syncSources; derive from reservations.source
--   * add_ons            — EF derives from transactions but times out at 240s
--   * tax_fee_records    — same — never reached because add_ons hangs first
--   * adjustments        — same
--   * reservation_rooms  — EF upserts with onConflict cols that no longer match
--                          the post-dedup unique index. Re-derive from
--                          reservations.raw JSONB using correct constraint.
--
-- All functions are SECURITY DEFINER, search_path locked, return a row count.
-- f_derive_all_extras() runs all six in sequence and returns a summary jsonb.
-- =============================================================================

-- 1. guests — derive from reservations (1 row per cb_guest_id)
CREATE OR REPLACE FUNCTION public.f_derive_guests()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  WITH derived AS (
    SELECT
      cb_guest_id AS guest_id,
      MAX(property_id) AS property_id,
      -- Split guest_name on first space — best-effort given Cloudbeds doesn't surface first/last separately
      NULLIF(SPLIT_PART(MAX(guest_name), ' ', 1), '') AS first_name,
      NULLIF(NULLIF(SUBSTRING(MAX(guest_name) FROM POSITION(' ' IN MAX(guest_name)) + 1), MAX(guest_name)), '') AS last_name,
      MAX(guest_email) AS email,
      NULLIF(MAX(guest_country), '') AS country,
      COUNT(*) AS total_stays,
      MAX(check_in_date)::date AS last_stay_date,
      SUM(COALESCE(total_amount, 0)) AS total_spent,
      jsonb_build_object('derived_from', 'reservations.cb_guest_id', 'reservation_count', COUNT(*)) AS raw
    FROM public.reservations
    WHERE cb_guest_id IS NOT NULL AND cb_guest_id <> ''
    GROUP BY cb_guest_id
  )
  INSERT INTO public.guests AS g
    (guest_id, property_id, first_name, last_name, email, country,
     total_stays, last_stay_date, total_spent, is_repeat, raw, synced_at)
  SELECT guest_id, property_id, first_name, last_name, email, country,
         total_stays, last_stay_date, total_spent, total_stays > 1,
         raw, now()
  FROM derived
  ON CONFLICT (guest_id) DO UPDATE SET
    property_id    = EXCLUDED.property_id,
    first_name     = COALESCE(EXCLUDED.first_name, g.first_name),
    last_name      = COALESCE(EXCLUDED.last_name, g.last_name),
    email          = COALESCE(EXCLUDED.email, g.email),
    country        = COALESCE(EXCLUDED.country, g.country),
    total_stays    = EXCLUDED.total_stays,
    last_stay_date = EXCLUDED.last_stay_date,
    total_spent    = EXCLUDED.total_spent,
    is_repeat      = EXCLUDED.is_repeat,
    raw            = EXCLUDED.raw,
    synced_at      = EXCLUDED.synced_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  -- Bump watermark
  INSERT INTO public.sync_watermarks(entity, last_synced_at, metadata, updated_at)
  VALUES ('guests', now(), jsonb_build_object('strategy','derived_from_reservations','rows',n), now())
  ON CONFLICT (entity) DO UPDATE SET last_synced_at=now(), metadata=jsonb_build_object('strategy','derived_from_reservations','rows',n), updated_at=now();
  RETURN n;
END $$;

-- 2. sources — derive from reservations.source / source_name
CREATE OR REPLACE FUNCTION public.f_derive_sources()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  WITH derived AS (
    SELECT DISTINCT ON (source)
      source AS source_id,
      MAX(property_id) AS property_id,
      COALESCE(NULLIF(MAX(source_name), ''), source) AS name,
      CASE
        WHEN MAX(source_name) ILIKE '%booking.com%' OR MAX(source_name) ILIKE '%expedia%' OR MAX(source_name) ILIKE '%agoda%'
          OR MAX(source_name) ILIKE '%airbnb%' OR MAX(source_name) ILIKE '%trip.com%' OR MAX(source_name) ILIKE '%hotels.com%'
          OR MAX(source_name) ILIKE '%synxis%' THEN 'OTA'
        WHEN MAX(source_name) ILIKE '%direct%' OR MAX(source_name) ILIKE '%website%' OR MAX(source_name) ILIKE '%walk%' THEN 'Direct'
        WHEN MAX(source_name) ILIKE '%wholesale%' OR MAX(source_name) ILIKE '%dmc%' OR MAX(source_name) ILIKE '%hotelbeds%' OR MAX(source_name) ILIKE '%webbeds%' THEN 'Wholesale'
        WHEN MAX(source_name) ILIKE '%group%' THEN 'Group'
        ELSE 'Other'
      END AS category,
      jsonb_build_object('derived_from', 'reservations.source', 'reservation_count', COUNT(*)) AS raw
    FROM public.reservations
    WHERE source IS NOT NULL AND source <> ''
    GROUP BY source
  )
  INSERT INTO public.sources AS s
    (source_id, property_id, name, category, is_active, raw, synced_at)
  SELECT source_id, property_id, name, category, true, raw, now()
  FROM derived
  ON CONFLICT (source_id) DO UPDATE SET
    name      = EXCLUDED.name,
    category  = EXCLUDED.category,
    raw       = EXCLUDED.raw,
    synced_at = EXCLUDED.synced_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.sync_watermarks(entity, last_synced_at, metadata, updated_at)
  VALUES ('sources', now(), jsonb_build_object('strategy','derived_from_reservations','rows',n), now())
  ON CONFLICT (entity) DO UPDATE SET last_synced_at=now(), metadata=jsonb_build_object('strategy','derived_from_reservations','rows',n), updated_at=now();
  RETURN n;
END $$;

-- 3. add_ons — derive from transactions in categories ('custom_item','product','addon')
CREATE OR REPLACE FUNCTION public.f_derive_add_ons(p_lookback interval DEFAULT interval '730 days')
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  WITH src AS (
    SELECT DISTINCT ON (reservation_id, COALESCE(description,'item'), transaction_date)
      property_id, reservation_id,
      COALESCE(description, 'item') AS item_name,
      COALESCE(item_category_name, category) AS item_category,
      GREATEST(COALESCE(quantity, 1)::int, 1) AS quantity,
      CASE WHEN COALESCE(quantity, 1) > 0 THEN COALESCE(amount, 0) / COALESCE(quantity, 1) ELSE COALESCE(amount, 0) END AS unit_price,
      COALESCE(amount, 0) AS total_amount,
      currency,
      transaction_date AS posted_date,
      jsonb_build_object('derived_from_transaction', transaction_id) AS raw
    FROM public.transactions
    WHERE category IN ('custom_item','product','addon')
      AND reservation_id IS NOT NULL
      AND transaction_date > now() - p_lookback
  )
  INSERT INTO public.add_ons AS a
    (property_id, reservation_id, item_name, item_category, quantity, unit_price, total_amount, currency, posted_date, raw, synced_at)
  SELECT property_id, reservation_id, item_name, item_category, quantity, unit_price, total_amount, currency, posted_date, raw, now()
  FROM src
  ON CONFLICT (reservation_id, item_name, posted_date) DO UPDATE SET
    quantity     = EXCLUDED.quantity,
    unit_price   = EXCLUDED.unit_price,
    total_amount = EXCLUDED.total_amount,
    currency     = EXCLUDED.currency,
    raw          = EXCLUDED.raw,
    synced_at    = EXCLUDED.synced_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.sync_watermarks(entity, last_synced_at, metadata, updated_at)
  VALUES ('add_ons', now(), jsonb_build_object('strategy','derived_from_transactions','rows',n), now())
  ON CONFLICT (entity) DO UPDATE SET last_synced_at=now(), metadata=jsonb_build_object('strategy','derived_from_transactions','rows',n), updated_at=now();
  RETURN n;
END $$;

-- 4. tax_fee_records — derive from transactions in categories ('tax','fee')
CREATE OR REPLACE FUNCTION public.f_derive_tax_fee_records(p_lookback interval DEFAULT interval '730 days')
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  WITH src AS (
    SELECT DISTINCT ON (reservation_id, COALESCE(description, category), transaction_date)
      property_id, reservation_id,
      COALESCE(description, category) AS tax_or_fee_name,
      category AS tax_type,
      amount,
      currency,
      transaction_date AS posted_date,
      jsonb_build_object('derived_from_transaction', transaction_id) AS raw
    FROM public.transactions
    WHERE category IN ('tax','fee')
      AND reservation_id IS NOT NULL
      AND transaction_date > now() - p_lookback
  )
  INSERT INTO public.tax_fee_records AS t
    (property_id, reservation_id, tax_or_fee_name, tax_type, amount, currency, posted_date, raw, synced_at)
  SELECT property_id, reservation_id, tax_or_fee_name, tax_type, amount, currency, posted_date, raw, now()
  FROM src
  ON CONFLICT (reservation_id, tax_or_fee_name, posted_date) DO UPDATE SET
    amount    = EXCLUDED.amount,
    currency  = EXCLUDED.currency,
    raw       = EXCLUDED.raw,
    synced_at = EXCLUDED.synced_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.sync_watermarks(entity, last_synced_at, metadata, updated_at)
  VALUES ('tax_fee_records', now(), jsonb_build_object('strategy','derived_from_transactions','rows',n), now())
  ON CONFLICT (entity) DO UPDATE SET last_synced_at=now(), metadata=jsonb_build_object('strategy','derived_from_transactions','rows',n), updated_at=now();
  RETURN n;
END $$;

-- 5. adjustments — derive from transactions in categories ('adjustment','void','refund')
CREATE OR REPLACE FUNCTION public.f_derive_adjustments()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  INSERT INTO public.adjustments AS a
    (adjustment_id, property_id, reservation_id, adjustment_type, description,
     amount, currency, is_taxable, posted_date, posted_by, raw, synced_at)
  SELECT
    'adj_' || transaction_id,
    property_id, reservation_id,
    COALESCE(transaction_type, category, 'adjustment'),
    description,
    amount, currency, NULL::boolean,
    transaction_date,
    user_name,
    jsonb_build_object('derived_from_transaction', transaction_id),
    now()
  FROM public.transactions
  WHERE category IN ('adjustment','void','refund')
  ON CONFLICT (adjustment_id) DO UPDATE SET
    description     = EXCLUDED.description,
    amount          = EXCLUDED.amount,
    adjustment_type = EXCLUDED.adjustment_type,
    posted_by       = EXCLUDED.posted_by,
    raw             = EXCLUDED.raw,
    synced_at       = EXCLUDED.synced_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.sync_watermarks(entity, last_synced_at, metadata, updated_at)
  VALUES ('adjustments', now(), jsonb_build_object('strategy','derived_from_transactions','rows',n), now())
  ON CONFLICT (entity) DO UPDATE SET last_synced_at=now(), metadata=jsonb_build_object('strategy','derived_from_transactions','rows',n), updated_at=now();
  RETURN n;
END $$;

-- 6. reservation_rooms — re-derive from reservations.raw JSONB using the
--    POST-dedup unique index reservation_rooms_uniq_logical:
--    (reservation_id, room_type_id, night_date, COALESCE(room_id, '__unassigned__'))
--    The Edge Function v14's onConflict clause references the OLD constraint
--    and silently fails — this function uses the correct expression so the
--    upsert actually happens.
CREATE OR REPLACE FUNCTION public.f_derive_reservation_rooms(p_lookback interval DEFAULT interval '7 days')
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  INSERT INTO public.reservation_rooms AS rr
    (reservation_id, room_type_id, room_id, night_date, rate, raw, synced_at)
  SELECT
    r.reservation_id,
    NULLIF(rm.value->>'roomTypeID', '')::bigint,
    NULLIF(rm.value->>'roomID', ''),
    drr.key::date,
    CASE WHEN jsonb_typeof(drr.value) IN ('number','string') THEN (drr.value)::text::numeric ELSE NULL END,
    jsonb_build_object('rateID', rm.value->'rateID', 'rate', drr.value),
    now()
  FROM public.reservations r,
       jsonb_array_elements(COALESCE(r.raw->'rooms', '[]'::jsonb)) rm,
       jsonb_each(COALESCE(rm.value->'detailedRoomRates', '{}'::jsonb)) drr
  WHERE r.synced_at > now() - p_lookback
  ON CONFLICT (reservation_id, room_type_id, night_date, COALESCE(room_id, '__unassigned__'::text))
    DO UPDATE SET
      rate      = EXCLUDED.rate,
      raw       = EXCLUDED.raw,
      synced_at = EXCLUDED.synced_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- 7. Wrapper — runs all 6 in one call, returns a summary jsonb.
CREATE OR REPLACE FUNCTION public.f_derive_all_extras()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  start_ts timestamptz := clock_timestamp();
BEGIN
  result := result || jsonb_build_object('guests',             public.f_derive_guests());
  result := result || jsonb_build_object('sources',            public.f_derive_sources());
  result := result || jsonb_build_object('add_ons',            public.f_derive_add_ons());
  result := result || jsonb_build_object('tax_fee_records',    public.f_derive_tax_fee_records());
  result := result || jsonb_build_object('adjustments',        public.f_derive_adjustments());
  result := result || jsonb_build_object('reservation_rooms',  public.f_derive_reservation_rooms());
  result := result || jsonb_build_object('duration_ms',        (extract(epoch from clock_timestamp() - start_ts) * 1000)::int);
  RETURN result;
END $$;

-- Grants — service_role can call; cron runs as postgres which has implicit
GRANT EXECUTE ON FUNCTION public.f_derive_guests()              TO service_role;
GRANT EXECUTE ON FUNCTION public.f_derive_sources()             TO service_role;
GRANT EXECUTE ON FUNCTION public.f_derive_add_ons(interval)     TO service_role;
GRANT EXECUTE ON FUNCTION public.f_derive_tax_fee_records(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.f_derive_adjustments()         TO service_role;
GRANT EXECUTE ON FUNCTION public.f_derive_reservation_rooms(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.f_derive_all_extras()          TO service_role;

-- Cron — every 3h at minute 30, offset from cb-sync-full-3h (minute 0)
-- so the EF sync runs first, then we derive from its results.
SELECT cron.schedule(
  'derive-extras-3h',
  '30 */3 * * *',
  $cron$ SELECT public.f_derive_all_extras() $cron$
);