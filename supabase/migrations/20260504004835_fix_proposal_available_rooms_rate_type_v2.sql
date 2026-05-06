-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504004835
-- Name:    fix_proposal_available_rooms_rate_type_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION public.proposal_available_rooms(from_date date, to_date date, prop_id bigint)
 RETURNS TABLE(room_type_id bigint, room_type_name text, nights_available bigint, nights_requested bigint, avg_nightly_lak numeric, min_avail_in_range integer, base_rate_lak numeric, hero_asset_url text)
 LANGUAGE sql
 STABLE
AS $function$
  WITH range AS (
    SELECT generate_series(from_date::date, (to_date::date - INTERVAL '1 day')::date, '1 day') AS night
  ),
  available_per_night AS (
    SELECT ri.room_type_id, ri.inventory_date, ri.rate, ri.available_rooms
    FROM public.rate_inventory ri
    JOIN public.rate_plans rp ON rp.rate_id = ri.rate_id AND rp.rate_type = 'base' AND rp.is_active
    WHERE ri.property_id = prop_id
      AND ri.inventory_date BETWEEN from_date AND (to_date - INTERVAL '1 day')
      AND ri.available_rooms > 0
      AND ri.stop_sell = false
      AND ri.rate > 0
  )
  SELECT
    rt.room_type_id,
    rt.room_type_name,
    COUNT(DISTINCT a.inventory_date)::BIGINT AS nights_available,
    (SELECT COUNT(*) FROM range)::BIGINT     AS nights_requested,
    AVG(a.rate)::numeric(12,2)               AS avg_nightly_lak,
    MIN(a.available_rooms)::INT              AS min_avail_in_range,
    rt.base_rate                             AS base_rate_lak,
    NULL::TEXT                               AS hero_asset_url
  FROM public.room_types rt
  JOIN available_per_night a ON a.room_type_id = rt.room_type_id
  WHERE rt.property_id = prop_id
  GROUP BY rt.room_type_id, rt.room_type_name, rt.base_rate
  HAVING COUNT(DISTINCT a.inventory_date) = (SELECT COUNT(*) FROM range)
  ORDER BY avg_nightly_lak ASC;
$function$;
