-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504192412
-- Name:    2026_05_04_pricing_strategy_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Day-of-week positioning (avg comp median by DoW vs Namkhan)
CREATE OR REPLACE VIEW public.v_pricing_dow_positioning AS
SELECT
  EXTRACT(ISODOW FROM stay_date)::int AS dow,
  TO_CHAR(stay_date, 'Dy')             AS dow_label,
  ROUND(AVG(namkhan_usd)::numeric, 2)  AS avg_namkhan_usd,
  ROUND(AVG(median_usd)::numeric, 2)   AS avg_comp_median_usd,
  ROUND(AVG(min_usd)::numeric, 2)      AS avg_comp_cheapest_usd,
  ROUND(AVG(max_usd)::numeric, 2)      AS avg_comp_dearest_usd,
  COUNT(*) FILTER (WHERE namkhan_usd IS NOT NULL) AS days_with_namkhan,
  COUNT(*) FILTER (WHERE median_usd IS NOT NULL)  AS days_with_comp
FROM public.v_pricing_calendar
GROUP BY 1, 2
ORDER BY 1;

GRANT SELECT ON public.v_pricing_dow_positioning TO anon, authenticated, service_role;

-- Cancellation policy compare (best-flex / non-refundable cut-off + discount per comp)
CREATE OR REPLACE VIEW public.v_pricing_cancellation_compare AS
WITH per_comp AS (
  SELECT cp.property_name, cp.is_self,
    AVG(rp.cancellation_deadline_days) FILTER (WHERE rp.is_refundable AND rp.cancellation_deadline_days IS NOT NULL) AS avg_cancel_days,
    AVG(rp.discount_pct) FILTER (WHERE NOT rp.is_refundable AND rp.discount_pct IS NOT NULL) AS avg_nonref_discount_pct,
    COUNT(*) FILTER (WHERE rp.is_refundable) AS refundable_count,
    COUNT(*) FILTER (WHERE NOT rp.is_refundable) AS non_refund_count
  FROM revenue.competitor_property cp
  LEFT JOIN revenue.competitor_rate_plans rp ON rp.comp_id = cp.comp_id AND rp.scrape_status = 'success'
  WHERE cp.is_active
    AND cp.set_id IN (SELECT set_id FROM revenue.competitor_set WHERE is_primary = true)
  GROUP BY cp.property_name, cp.is_self
)
SELECT property_name, is_self,
       ROUND(avg_cancel_days::numeric, 1)        AS avg_cancel_days,
       ROUND(avg_nonref_discount_pct::numeric, 1) AS avg_nonref_discount_pct,
       refundable_count, non_refund_count
FROM per_comp
ORDER BY is_self DESC, property_name;

GRANT SELECT ON public.v_pricing_cancellation_compare TO anon, authenticated, service_role;

-- Meal-type comparison (per comp — most common meal plan + breakfast supplement signal)
CREATE OR REPLACE VIEW public.v_pricing_meal_compare AS
SELECT
  cp.property_name, cp.is_self,
  COUNT(*) FILTER (WHERE rp.meal_plan = 'breakfast')        AS plans_with_breakfast,
  COUNT(*) FILTER (WHERE rp.meal_plan = 'room_only')        AS plans_room_only,
  COUNT(*) FILTER (WHERE rp.meal_plan = 'half_board')       AS plans_half_board,
  COUNT(*) FILTER (WHERE rp.meal_plan = 'full_board')       AS plans_full_board,
  COUNT(*)                                                   AS plans_total,
  ROUND(
    AVG(rp.rate_usd) FILTER (WHERE rp.meal_plan = 'breakfast')::numeric, 2
  ) AS avg_rate_with_breakfast,
  ROUND(
    AVG(rp.rate_usd) FILTER (WHERE rp.meal_plan = 'room_only')::numeric, 2
  ) AS avg_rate_room_only
FROM revenue.competitor_property cp
LEFT JOIN revenue.competitor_rate_plans rp ON rp.comp_id = cp.comp_id AND rp.scrape_status = 'success' AND rp.rate_usd IS NOT NULL
WHERE cp.is_active
  AND cp.set_id IN (SELECT set_id FROM revenue.competitor_set WHERE is_primary = true)
GROUP BY cp.property_name, cp.is_self
ORDER BY is_self DESC, property_name;

GRANT SELECT ON public.v_pricing_meal_compare TO anon, authenticated, service_role;

-- Lead-time pricing pattern (avg rate by days-to-stay bucket per comp)
CREATE OR REPLACE VIEW public.v_pricing_leadtime_pattern AS
SELECT
  cp.property_name, cp.is_self,
  CASE
    WHEN (cr.stay_date - cr.shop_date) <= 7   THEN '0-7d'
    WHEN (cr.stay_date - cr.shop_date) <= 14  THEN '8-14d'
    WHEN (cr.stay_date - cr.shop_date) <= 30  THEN '15-30d'
    WHEN (cr.stay_date - cr.shop_date) <= 60  THEN '31-60d'
    WHEN (cr.stay_date - cr.shop_date) <= 90  THEN '61-90d'
    ELSE                                            '90d+'
  END AS leadtime_bucket,
  ROUND(AVG(cr.rate_usd)::numeric, 2) AS avg_rate_usd,
  COUNT(*) AS obs_count
FROM revenue.competitor_property cp
JOIN revenue.competitor_rates cr ON cr.comp_id = cp.comp_id
WHERE cp.is_active
  AND cp.set_id IN (SELECT set_id FROM revenue.competitor_set WHERE is_primary = true)
  AND cr.channel = 'booking' AND cr.scrape_status = 'success' AND cr.rate_usd IS NOT NULL
GROUP BY cp.property_name, cp.is_self,
  CASE
    WHEN (cr.stay_date - cr.shop_date) <= 7   THEN '0-7d'
    WHEN (cr.stay_date - cr.shop_date) <= 14  THEN '8-14d'
    WHEN (cr.stay_date - cr.shop_date) <= 30  THEN '15-30d'
    WHEN (cr.stay_date - cr.shop_date) <= 60  THEN '31-60d'
    WHEN (cr.stay_date - cr.shop_date) <= 90  THEN '61-90d'
    ELSE                                            '90d+'
  END
ORDER BY is_self DESC, property_name;

GRANT SELECT ON public.v_pricing_leadtime_pattern TO anon, authenticated, service_role;
