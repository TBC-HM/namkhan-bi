-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503201210
-- Name:    fix_derive_reservation_rooms_dedup_source
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Source rows can collide on the unique key (same reservation × room_type × night,
-- with the same room_id or both NULL). Dedupe at the source via DISTINCT ON,
-- keeping the highest rate when there are multiple (matches Cloudbeds' "current"
-- rate semantics where the latest detailedRoomRates entry wins).
CREATE OR REPLACE FUNCTION public.f_derive_reservation_rooms(p_lookback interval DEFAULT interval '7 days')
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  WITH expanded AS (
    SELECT
      r.reservation_id,
      NULLIF(rm.value->>'roomTypeID','')::bigint AS room_type_id,
      NULLIF(rm.value->>'roomID','')              AS room_id,
      drr.key::date                                AS night_date,
      CASE WHEN jsonb_typeof(drr.value) IN ('number','string') THEN (drr.value)::text::numeric ELSE NULL END AS rate,
      jsonb_build_object('rateID', rm.value->'rateID', 'rate', drr.value) AS raw
    FROM public.reservations r,
         jsonb_array_elements(COALESCE(r.raw->'rooms','[]'::jsonb)) rm,
         jsonb_each(COALESCE(rm.value->'detailedRoomRates','{}'::jsonb)) drr
    WHERE r.synced_at > now() - p_lookback
  ), deduped AS (
    SELECT DISTINCT ON (reservation_id, room_type_id, night_date, COALESCE(room_id,'__unassigned__'))
      reservation_id, room_type_id, room_id, night_date, rate, raw
    FROM expanded
    ORDER BY reservation_id, room_type_id, night_date, COALESCE(room_id,'__unassigned__'), rate DESC NULLS LAST
  )
  INSERT INTO public.reservation_rooms AS rr
    (reservation_id, room_type_id, room_id, night_date, rate, raw, synced_at)
  SELECT reservation_id, room_type_id, room_id, night_date, rate, raw, now()
  FROM deduped
  ON CONFLICT (reservation_id, room_type_id, night_date, COALESCE(room_id, '__unassigned__'::text))
    DO UPDATE SET
      rate      = EXCLUDED.rate,
      raw       = EXCLUDED.raw,
      synced_at = EXCLUDED.synced_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.f_derive_reservation_rooms(interval) TO service_role;