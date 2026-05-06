-- Migration 6/6 — sales-proposal-builder. APPLIED 2026-05-03.
-- Live-verified column types:
--   public.rate_inventory.property_id  BIGINT
--   public.rate_inventory.room_type_id BIGINT
--   public.rate_inventory.synced_at    TIMESTAMPTZ
BEGIN;

CREATE OR REPLACE FUNCTION public.proposal_available_rooms(
  from_date DATE,
  to_date   DATE,
  prop_id   BIGINT
) RETURNS TABLE (
  room_type_id        BIGINT,
  room_type_name      TEXT,
  nights_available    BIGINT,
  nights_requested    BIGINT,
  avg_nightly_lak     NUMERIC,
  min_avail_in_range  INT,
  base_rate_lak       NUMERIC,
  hero_asset_url      TEXT
) LANGUAGE SQL STABLE SECURITY INVOKER AS $func$
  WITH range AS (
    SELECT generate_series(from_date::date, (to_date::date - INTERVAL '1 day')::date, '1 day') AS night
  ),
  available_per_night AS (
    SELECT ri.room_type_id, ri.inventory_date, ri.rate, ri.available_rooms
    FROM public.rate_inventory ri
    JOIN public.rate_plans rp ON rp.rate_id = ri.rate_id AND rp.rate_type = 'BAR' AND rp.is_active
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
$func$;

GRANT EXECUTE ON FUNCTION public.proposal_available_rooms(DATE, DATE, BIGINT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proposal_inventory_freshness(prop_id BIGINT)
RETURNS INT LANGUAGE SQL STABLE SECURITY INVOKER AS $func$
  SELECT COALESCE(
    EXTRACT(EPOCH FROM (now() - MAX(synced_at)))::INT / 60,
    9999
  )
  FROM public.rate_inventory
  WHERE property_id = prop_id;
$func$;

GRANT EXECUTE ON FUNCTION public.proposal_inventory_freshness(BIGINT) TO anon, authenticated, service_role;

COMMIT;
