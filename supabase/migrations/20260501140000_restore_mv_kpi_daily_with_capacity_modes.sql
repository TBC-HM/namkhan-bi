-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501140000
-- Name:    restore_mv_kpi_daily_with_capacity_modes
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Restore mv_kpi_daily, but with all 3 capacity columns (selling, live, total)
-- so the frontend toggle can pick which denominator to use.
-- Also restore mv_capture_rates which was CASCADE'd.

CREATE MATERIALIZED VIEW public.mv_kpi_daily AS
WITH nightly AS (
  SELECT
    r.property_id,
    rr.night_date,
    count(*) FILTER (WHERE r.status NOT IN ('canceled','no_show')) AS rooms_sold,
    COALESCE(sum(rr.rate) FILTER (WHERE r.status NOT IN ('canceled','no_show')), 0) AS rooms_revenue
  FROM public.reservation_rooms rr
  JOIN public.reservations r ON r.reservation_id = rr.reservation_id
  GROUP BY r.property_id, rr.night_date
),
ancillary AS (
  SELECT
    ct.property_id,
    ct.transaction_date::date AS night_date,
    sum(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Food' THEN ct.amount ELSE 0 END) AS fnb_food_revenue,
    sum(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Beverage' THEN ct.amount ELSE 0 END) AS fnb_beverage_revenue,
    sum(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Minibar' THEN ct.amount ELSE 0 END) AS fnb_minibar_revenue,
    sum(CASE WHEN ct.usali_dept = 'F&B' THEN ct.amount ELSE 0 END) AS fnb_revenue,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Spa' THEN ct.amount ELSE 0 END) AS spa_revenue,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Activities' THEN ct.amount ELSE 0 END) AS activity_revenue,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Transportation' THEN ct.amount ELSE 0 END) AS transport_revenue,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' THEN ct.amount ELSE 0 END) AS other_operated_revenue,
    sum(CASE WHEN ct.usali_dept = 'Retail' THEN ct.amount ELSE 0 END) AS retail_revenue,
    sum(CASE WHEN ct.usali_dept NOT IN ('Tax','Fee','Adjustment','Rooms') THEN ct.amount ELSE 0 END) AS total_ancillary_revenue,
    sum(CASE WHEN ct.usali_dept = 'Unclassified' THEN ct.amount ELSE 0 END) AS unclassified_revenue
  FROM public.mv_classified_transactions ct
  WHERE ct.category IN ('custom_item','product','addon')
    AND ct.transaction_date IS NOT NULL
  GROUP BY ct.property_id, ct.transaction_date::date
)
SELECT
  COALESCE(n.property_id, a.property_id) AS property_id,
  COALESCE(n.night_date, a.night_date) AS night_date,
  COALESCE(n.rooms_sold, 0) AS rooms_sold,
  inv.total_rooms,                      -- default: capacity_selling = 24
  inv.capacity_selling,
  inv.capacity_live,
  inv.capacity_total,
  inv.total_rooms AS rooms_inventory,   -- legacy alias
  GREATEST(inv.total_rooms - COALESCE(n.rooms_sold, 0), 0) AS rooms_unsold,
  GREATEST(inv.total_rooms - COALESCE(n.rooms_sold, 0), 0) AS rooms_available,
  -- Occupancy% defaulted to selling capacity. FE can recompute with other modes.
  round(100.0 * COALESCE(n.rooms_sold, 0)::numeric / NULLIF(inv.total_rooms, 0)::numeric, 2) AS occupancy_pct,
  COALESCE(n.rooms_revenue, 0) AS rooms_revenue,
  round(COALESCE(n.rooms_revenue, 0) / NULLIF(n.rooms_sold, 0)::numeric, 2) AS adr,
  round(COALESCE(n.rooms_revenue, 0) / NULLIF(inv.total_rooms, 0)::numeric, 2) AS revpar,
  COALESCE(a.fnb_food_revenue, 0) AS fnb_food_revenue,
  COALESCE(a.fnb_beverage_revenue, 0) AS fnb_beverage_revenue,
  COALESCE(a.fnb_minibar_revenue, 0) AS fnb_minibar_revenue,
  COALESCE(a.fnb_revenue, 0) AS fnb_revenue,
  COALESCE(a.spa_revenue, 0) AS spa_revenue,
  COALESCE(a.activity_revenue, 0) AS activity_revenue,
  COALESCE(a.transport_revenue, 0) AS transport_revenue,
  COALESCE(a.other_operated_revenue, 0) AS other_operated_revenue,
  COALESCE(a.retail_revenue, 0) AS retail_revenue,
  COALESCE(a.total_ancillary_revenue, 0) AS total_ancillary_revenue,
  COALESCE(a.unclassified_revenue, 0) AS unclassified_revenue,
  round((COALESCE(n.rooms_revenue, 0) + COALESCE(a.total_ancillary_revenue, 0))
        / NULLIF(inv.total_rooms, 0)::numeric, 2) AS trevpar
FROM nightly n
FULL JOIN ancillary a ON n.property_id = a.property_id AND n.night_date = a.night_date
LEFT JOIN public.v_property_inventory inv ON inv.property_id = COALESCE(n.property_id, a.property_id);

CREATE UNIQUE INDEX idx_mv_kpi_daily_pk ON public.mv_kpi_daily (property_id, night_date);
