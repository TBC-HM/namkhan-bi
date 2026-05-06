-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429224902
-- Name:    fix_kpi_daily_b5_naming_2026_04_30
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B5: mv_kpi_daily had `rooms_available` = total_rooms - rooms_sold (i.e. UNSOLD rooms)
-- This is misleading: in hospitality, "rooms_available" usually means inventory.
-- Fix: add `rooms_inventory` (= total_rooms when active) AND `rooms_unsold` (the old field).
-- Keep `rooms_available` aliased to `rooms_inventory` so all "SUM(rooms_available)" math
-- in the dashboard now produces correct denominators.
-- This is a SEMANTIC change — flag in CHANGELOG.

DROP MATERIALIZED VIEW IF EXISTS public.mv_kpi_daily CASCADE;

CREATE MATERIALIZED VIEW public.mv_kpi_daily AS
WITH nightly AS (
  SELECT
    r.property_id,
    rr.night_date,
    COUNT(*) FILTER (WHERE r.status NOT IN ('canceled','no_show')) AS rooms_sold,
    COALESCE(SUM(rr.rate) FILTER (WHERE r.status NOT IN ('canceled','no_show')), 0) AS rooms_revenue
  FROM reservation_rooms rr
  JOIN reservations r ON r.reservation_id = rr.reservation_id
  GROUP BY r.property_id, rr.night_date
),
ancillary AS (
  SELECT
    ct.property_id,
    ct.transaction_date::date AS night_date,
    SUM(CASE WHEN ct.usali_dept='F&B' AND ct.usali_subdept='Food'     THEN ct.amount ELSE 0 END) AS fnb_food_revenue,
    SUM(CASE WHEN ct.usali_dept='F&B' AND ct.usali_subdept='Beverage' THEN ct.amount ELSE 0 END) AS fnb_beverage_revenue,
    SUM(CASE WHEN ct.usali_dept='F&B' AND ct.usali_subdept='Minibar'  THEN ct.amount ELSE 0 END) AS fnb_minibar_revenue,
    SUM(CASE WHEN ct.usali_dept='F&B' THEN ct.amount ELSE 0 END) AS fnb_revenue,
    SUM(CASE WHEN ct.usali_dept='Other Operated' AND ct.usali_subdept='Spa' THEN ct.amount ELSE 0 END) AS spa_revenue,
    SUM(CASE WHEN ct.usali_dept='Other Operated' AND ct.usali_subdept='Activities' THEN ct.amount ELSE 0 END) AS activity_revenue,
    SUM(CASE WHEN ct.usali_dept='Other Operated' AND ct.usali_subdept='Transportation' THEN ct.amount ELSE 0 END) AS transport_revenue,
    SUM(CASE WHEN ct.usali_dept='Other Operated' THEN ct.amount ELSE 0 END) AS other_operated_revenue,
    SUM(CASE WHEN ct.usali_dept='Retail' THEN ct.amount ELSE 0 END) AS retail_revenue,
    SUM(CASE WHEN ct.usali_dept NOT IN ('Tax','Fee','Adjustment','Rooms') THEN ct.amount ELSE 0 END) AS total_ancillary_revenue,
    SUM(CASE WHEN ct.usali_dept='Unclassified' THEN ct.amount ELSE 0 END) AS unclassified_revenue
  FROM mv_classified_transactions ct
  WHERE ct.category IN ('custom_item','product','addon')
    AND ct.transaction_date IS NOT NULL
  GROUP BY ct.property_id, ct.transaction_date::date
)
SELECT
  COALESCE(n.property_id, a.property_id) AS property_id,
  COALESCE(n.night_date, a.night_date)   AS night_date,
  COALESCE(n.rooms_sold, 0) AS rooms_sold,
  inv.total_rooms,
  -- B5 fix: rooms_available NOW means inventory (correct denominator for occupancy/RevPAR)
  inv.total_rooms AS rooms_available,
  -- new explicit field for unsold rooms
  GREATEST(inv.total_rooms - COALESCE(n.rooms_sold, 0), 0) AS rooms_unsold,
  ROUND(100.0 * COALESCE(n.rooms_sold,0)::numeric / NULLIF(inv.total_rooms,0)::numeric, 2) AS occupancy_pct,
  COALESCE(n.rooms_revenue, 0) AS rooms_revenue,
  ROUND(COALESCE(n.rooms_revenue,0) / NULLIF(n.rooms_sold,0)::numeric, 2) AS adr,
  ROUND(COALESCE(n.rooms_revenue,0) / NULLIF(inv.total_rooms,0)::numeric, 2) AS revpar,
  COALESCE(a.fnb_food_revenue,0)        AS fnb_food_revenue,
  COALESCE(a.fnb_beverage_revenue,0)    AS fnb_beverage_revenue,
  COALESCE(a.fnb_minibar_revenue,0)     AS fnb_minibar_revenue,
  COALESCE(a.fnb_revenue,0)             AS fnb_revenue,
  COALESCE(a.spa_revenue,0)             AS spa_revenue,
  COALESCE(a.activity_revenue,0)        AS activity_revenue,
  COALESCE(a.transport_revenue,0)       AS transport_revenue,
  COALESCE(a.other_operated_revenue,0)  AS other_operated_revenue,
  COALESCE(a.retail_revenue,0)          AS retail_revenue,
  COALESCE(a.total_ancillary_revenue,0) AS total_ancillary_revenue,
  COALESCE(a.unclassified_revenue,0)    AS unclassified_revenue,
  ROUND((COALESCE(n.rooms_revenue,0) + COALESCE(a.total_ancillary_revenue,0))
        / NULLIF(inv.total_rooms,0)::numeric, 2) AS trevpar
FROM nightly n
FULL JOIN ancillary a ON n.property_id = a.property_id AND n.night_date = a.night_date
LEFT JOIN v_property_inventory inv ON inv.property_id = COALESCE(n.property_id, a.property_id);

CREATE UNIQUE INDEX idx_mv_kpi_daily_pk   ON public.mv_kpi_daily (property_id, night_date);
CREATE INDEX        idx_mv_kpi_daily_date ON public.mv_kpi_daily (night_date);

COMMENT ON MATERIALIZED VIEW public.mv_kpi_daily IS
'Per-property per-night KPIs. B5 fix 2026-04-30: rooms_available NOW = inventory (denominator). rooms_unsold = old field semantics. Use rooms_unsold if you need available-to-sell count.';
COMMENT ON COLUMN public.mv_kpi_daily.rooms_available IS 'Inventory (total_rooms). Correct denominator for occupancy/RevPAR. Renamed-semantically from prior unsold-rooms meaning.';
COMMENT ON COLUMN public.mv_kpi_daily.rooms_unsold IS 'Rooms not yet sold for this night = total_rooms - rooms_sold. Use for availability views.';