-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501140044
-- Name:    restore_mv_capture_rates
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Recreate mv_capture_rates as a property-level summary
-- Aggregates kpi.v_capture_rate_daily over the last 90 days

CREATE MATERIALIZED VIEW public.mv_capture_rates AS
WITH agg AS (
  SELECT
    260955::bigint AS property_id,
    'F&B'::text AS dept,
    sum(reservations_in_house) AS res_in_house,
    sum(res_with_purchase) AS res_with_purchase,
    sum(revenue) AS revenue,
    sum(occupied_room_nights) AS roomnights
  FROM kpi.v_capture_rate_daily
  WHERE stay_date BETWEEN current_date - 90 AND current_date
    AND usali_dept = 'F&B'
  UNION ALL
  SELECT 260955, 'Spa',
    sum(reservations_in_house), sum(res_with_purchase), sum(revenue), sum(occupied_room_nights)
  FROM kpi.v_capture_rate_daily
  WHERE stay_date BETWEEN current_date - 90 AND current_date
    AND usali_dept = 'Other Operated' AND usali_subdept = 'Spa'
  UNION ALL
  SELECT 260955, 'Activities',
    sum(reservations_in_house), sum(res_with_purchase), sum(revenue), sum(occupied_room_nights)
  FROM kpi.v_capture_rate_daily
  WHERE stay_date BETWEEN current_date - 90 AND current_date
    AND usali_dept = 'Other Operated' AND usali_subdept = 'Activities'
  UNION ALL
  SELECT 260955, 'Retail',
    sum(reservations_in_house), sum(res_with_purchase), sum(revenue), sum(occupied_room_nights)
  FROM kpi.v_capture_rate_daily
  WHERE stay_date BETWEEN current_date - 90 AND current_date
    AND usali_dept = 'Retail'
)
SELECT
  property_id,
  dept,
  COALESCE(res_in_house, 0) AS res_in_house,
  COALESCE(res_with_purchase, 0) AS res_with_purchase,
  COALESCE(revenue, 0) AS revenue,
  COALESCE(roomnights, 0) AS roomnights,
  ROUND(100.0 * COALESCE(res_with_purchase, 0)::numeric
        / NULLIF(res_in_house, 0)::numeric, 1) AS capture_rate_pct,
  ROUND(COALESCE(revenue, 0) / NULLIF(roomnights, 0)::numeric, 2) AS spend_per_occ_room
FROM agg;

CREATE UNIQUE INDEX idx_mv_capture_rates_pk ON public.mv_capture_rates (property_id, dept);
