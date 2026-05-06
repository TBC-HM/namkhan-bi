-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427183805
-- Name:    kpi_fb_outlet_daypart
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- MODULE 3: F&B outlet + day-part attribution
-- Realistic given the data: single-outlet (The Roots) with
-- meal-period inference from item categories
-- ============================================================

-- Tag F&B transactions with inferred meal period via description+category
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fb_meal_period text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fb_outlet text;

UPDATE transactions
SET fb_meal_period = CASE
  WHEN description ILIKE '%breakfast%' OR description ILIKE '%granola%' 
    OR description ILIKE '%omelette%' OR description ILIKE '%pancake%'
    OR item_category_name ILIKE '%breakfast%' THEN 'Breakfast'
  WHEN item_category_name ILIKE '%children%' OR description ILIKE '%kids%' 
    OR description ILIKE '%junior menu%' THEN 'Kids'
  WHEN item_category_name ILIKE '%minibar%' THEN 'Minibar'
  WHEN description ILIKE '%cocktail%' OR description ILIKE '%shot%'
    OR item_category_name ILIKE '%cocktail%' OR item_category_name ILIKE '%spirit%'
    OR item_category_name ILIKE '%liquor%' OR item_category_name ILIKE '%gin%'
    OR item_category_name ILIKE '%rum%' OR item_category_name ILIKE '%whisk%'
    OR item_category_name ILIKE '%vodka%' OR item_category_name ILIKE '%cognac%'
    OR item_category_name ILIKE '%beer%' THEN 'Bar'
  WHEN item_category_name ILIKE '%starter%' OR item_category_name ILIKE '%main%'
    OR item_category_name ILIKE '%dessert%' OR item_category_name ILIKE '%salad%'
    OR item_category_name ILIKE '%side%' OR item_category_name ILIKE '%soup%'
    OR item_category_name ILIKE '%pasta%' OR item_category_name ILIKE '%pizza%'
    OR item_category_name ILIKE '%food%' OR item_category_name ILIKE '%menus%' THEN 'Restaurant'
  WHEN item_category_name ILIKE '%wine%' OR item_category_name ILIKE '%sparkling%' 
    THEN 'Wine'
  WHEN item_category_name ILIKE '%soft%' OR item_category_name ILIKE '%juice%'
    OR item_category_name ILIKE '%coffee%' OR item_category_name ILIKE '%tea%'
    OR item_category_name ILIKE '%mocktail%' OR item_category_name ILIKE '%non-alc%'
    THEN 'Non-Alcoholic'
  ELSE 'Other F&B'
END
WHERE usali_dept = 'F&B' AND fb_meal_period IS NULL;

-- Outlet: Namkhan today is single restaurant ("The Roots")
-- Distinguish only Restaurant / Minibar / Beach Hut BBQ where description hints
UPDATE transactions
SET fb_outlet = CASE
  WHEN description ILIKE '%beach hut%' OR description ILIKE '%bbq%' THEN 'Beach Hut BBQ'
  WHEN description ILIKE '%room service%' OR description ILIKE '%in-room%' 
    OR description ILIKE '%ird%' THEN 'In-Room Dining'
  WHEN item_category_name ILIKE '%minibar%' THEN 'Minibar'
  WHEN description ILIKE '%festive%' OR description ILIKE '%new year%' 
    OR description ILIKE '%special event%' THEN 'Special Event'
  ELSE 'The Roots' -- default to main restaurant
END
WHERE usali_dept = 'F&B' AND fb_outlet IS NULL;

CREATE INDEX IF NOT EXISTS idx_tx_fb_period ON transactions(fb_meal_period) WHERE usali_dept = 'F&B';
CREATE INDEX IF NOT EXISTS idx_tx_fb_outlet ON transactions(fb_outlet) WHERE usali_dept = 'F&B';

-- Outlet performance view
CREATE OR REPLACE VIEW kpi.v_fb_outlet_daily AS
SELECT 
  service_date,
  fb_outlet,
  fb_meal_period,
  COUNT(*) AS tx_count,
  COUNT(DISTINCT reservation_id) FILTER (WHERE reservation_id IS NOT NULL) AS reservations,
  SUM(amount) FILTER (WHERE transaction_type='debit') AS revenue,
  SUM(quantity) FILTER (WHERE transaction_type='debit') AS items
FROM transactions
WHERE usali_dept = 'F&B' AND service_date IS NOT NULL
GROUP BY service_date, fb_outlet, fb_meal_period;

-- F&B outlet × period rollup (function)
CREATE OR REPLACE FUNCTION kpi.fb_outlet_summary(
  p_from date DEFAULT (CURRENT_DATE - 30),
  p_to date DEFAULT (CURRENT_DATE - 1)
) RETURNS TABLE(
  outlet text, meal_period text,
  tx_count bigint, reservations bigint, revenue numeric, avg_ticket numeric, items numeric
) AS $$
  SELECT 
    fb_outlet, fb_meal_period,
    COUNT(*),
    COUNT(DISTINCT reservation_id) FILTER (WHERE reservation_id IS NOT NULL),
    ROUND(SUM(amount)::numeric, 0),
    ROUND(AVG(amount)::numeric, 2),
    SUM(quantity)::numeric
  FROM transactions
  WHERE usali_dept = 'F&B'
    AND service_date BETWEEN p_from AND p_to
    AND transaction_type = 'debit'
  GROUP BY fb_outlet, fb_meal_period
  ORDER BY SUM(amount) DESC NULLS LAST;
$$ LANGUAGE sql STABLE;
