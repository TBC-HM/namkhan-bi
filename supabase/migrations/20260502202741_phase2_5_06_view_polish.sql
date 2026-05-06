-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502202741
-- Name:    phase2_5_06_view_polish
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Phase 2.5 — view polish: add days_until_par to v_inv_days_of_cover
-- (spec page 2 mockup shows 3 distinct cover figures: at burn, until par hit, until reorder)
DROP VIEW IF EXISTS inv.v_inv_days_of_cover;
CREATE VIEW inv.v_inv_days_of_cover AS
WITH burn AS (
  SELECT item_id,
    SUM(CASE WHEN movement_type IN ('issue','consume','waste','transfer_out') THEN ABS(quantity) ELSE 0 END) / 30.0 AS units_per_day_30d
  FROM inv.movements
  WHERE movement_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY item_id
),
total_par AS (
  SELECT item_id, SUM(par_quantity) AS total_par
  FROM inv.par_levels GROUP BY item_id
)
SELECT i.item_id, i.sku, i.item_name,
  COALESCE(soh.total_on_hand, 0)   AS on_hand,
  COALESCE(b.units_per_day_30d, 0) AS burn_per_day,
  CASE WHEN COALESCE(b.units_per_day_30d, 0) = 0 THEN NULL
       ELSE ROUND(COALESCE(soh.total_on_hand, 0) / b.units_per_day_30d, 1) END AS days_of_cover,
  -- Until par hit (using sum of par across locations)
  tp.total_par AS par_quantity,
  CASE WHEN COALESCE(b.units_per_day_30d, 0) = 0 OR tp.total_par IS NULL THEN NULL
       ELSE ROUND((COALESCE(soh.total_on_hand, 0) - tp.total_par) / NULLIF(b.units_per_day_30d, 0), 1) END AS days_until_par,
  -- Until reorder (item-level reorder_point)
  i.reorder_point,
  CASE WHEN COALESCE(b.units_per_day_30d, 0) = 0 OR i.reorder_point IS NULL THEN NULL
       ELSE ROUND((COALESCE(soh.total_on_hand, 0) - i.reorder_point) / NULLIF(b.units_per_day_30d, 0), 1) END AS days_until_reorder
FROM inv.items i
LEFT JOIN inv.v_inv_stock_on_hand soh ON soh.item_id = i.item_id
LEFT JOIN burn b ON b.item_id = i.item_id
LEFT JOIN total_par tp ON tp.item_id = i.item_id
WHERE i.is_active;
GRANT SELECT ON inv.v_inv_days_of_cover TO authenticated, service_role;
