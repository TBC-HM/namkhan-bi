-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503174149
-- Name:    rate_plans_views_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- FILTER goes inside the aggregate, not on ROUND
CREATE OR REPLACE VIEW revenue.competitor_rate_plan_mix AS
WITH latest_per_plan AS (
  SELECT DISTINCT ON (comp_id, channel, taxonomy_code, stay_date)
    comp_id, channel, taxonomy_code, stay_date, raw_label,
    rate_usd, has_strikethrough, discount_pct, is_refundable, meal_plan,
    advance_purchase_days, min_los_required, is_member_only, shop_date
  FROM revenue.competitor_rate_plans
  WHERE scrape_status = 'success' AND rate_usd IS NOT NULL
    AND shop_date >= CURRENT_DATE - 7
  ORDER BY comp_id, channel, taxonomy_code, stay_date, shop_date DESC
)
SELECT 
  cp.comp_id, cp.property_name, cp.is_self,
  lpp.channel, lpp.taxonomy_code, t.display_name AS plan_name, t.category,
  COUNT(DISTINCT lpp.stay_date) AS dates_offered,
  ROUND(AVG(lpp.rate_usd), 2) AS avg_rate_usd,
  MIN(lpp.rate_usd) AS min_rate_usd,
  MAX(lpp.rate_usd) AS max_rate_usd,
  ROUND(AVG(lpp.discount_pct), 1) AS avg_discount_pct,
  BOOL_OR(lpp.is_member_only) AS has_member_variant,
  COUNT(DISTINCT lpp.raw_label) AS distinct_labels
FROM latest_per_plan lpp
JOIN revenue.competitor_property cp ON cp.comp_id = lpp.comp_id
JOIN revenue.rate_plan_taxonomy t ON t.taxonomy_code = lpp.taxonomy_code
GROUP BY cp.comp_id, cp.property_name, cp.is_self, lpp.channel, lpp.taxonomy_code, t.display_name, t.category, t.display_order
ORDER BY cp.is_self DESC, cp.property_name, lpp.channel, t.display_order;

CREATE OR REPLACE VIEW revenue.rate_plan_landscape AS
SELECT 
  t.category, t.taxonomy_code, t.display_name AS plan_name,
  COUNT(DISTINCT crp.comp_id) AS competitors_offering,
  COUNT(DISTINCT crp.comp_id) FILTER (WHERE NOT cp.is_self) AS comps_offering_excl_self,
  COUNT(DISTINCT crp.channel) AS channels_seen,
  ROUND(AVG(crp.rate_usd), 2) AS avg_rate_usd,
  ROUND(AVG(crp.discount_pct) FILTER (WHERE crp.has_strikethrough), 1) AS avg_discount_when_promoted,
  BOOL_OR(crp.comp_id = (SELECT comp_id FROM revenue.competitor_property WHERE is_self = true LIMIT 1)) AS namkhan_offers,
  ARRAY_AGG(DISTINCT cp.property_name) FILTER (WHERE NOT cp.is_self) AS comps_offering_list
FROM revenue.competitor_rate_plans crp
JOIN revenue.rate_plan_taxonomy t ON t.taxonomy_code = crp.taxonomy_code
JOIN revenue.competitor_property cp ON cp.comp_id = crp.comp_id
WHERE crp.scrape_status = 'success' AND crp.shop_date >= CURRENT_DATE - 7
GROUP BY t.category, t.taxonomy_code, t.display_name, t.display_order
ORDER BY t.display_order;

CREATE OR REPLACE VIEW revenue.ranking_latest AS
SELECT DISTINCT ON (comp_id, channel, search_destination, sort_order)
  comp_id, channel, search_destination, sort_order,
  position, total_results, page_number,
  is_above_fold, is_first_page, has_sponsored_badge, has_genius_badge,
  shop_date, CURRENT_DATE - shop_date AS days_old
FROM revenue.competitor_platform_rankings
ORDER BY comp_id, channel, search_destination, sort_order, shop_date DESC;

CREATE OR REPLACE VIEW revenue.ranking_movement AS
WITH this_week AS (
  SELECT DISTINCT ON (comp_id, channel, search_destination, sort_order)
    comp_id, channel, search_destination, sort_order, position, shop_date
  FROM revenue.competitor_platform_rankings
  WHERE shop_date >= CURRENT_DATE - 1
  ORDER BY comp_id, channel, search_destination, sort_order, shop_date DESC
),
last_week AS (
  SELECT DISTINCT ON (comp_id, channel, search_destination, sort_order)
    comp_id, channel, search_destination, sort_order, position AS prev_position, shop_date AS prev_shop_date
  FROM revenue.competitor_platform_rankings
  WHERE shop_date BETWEEN CURRENT_DATE - 8 AND CURRENT_DATE - 6
  ORDER BY comp_id, channel, search_destination, sort_order, shop_date DESC
)
SELECT 
  cp.property_name, cp.is_self,
  tw.channel, tw.search_destination, tw.sort_order,
  tw.position AS current_position, lw.prev_position,
  (lw.prev_position - tw.position) AS positions_gained,
  CASE 
    WHEN lw.prev_position IS NULL THEN 'new_in_results'
    WHEN tw.position < lw.prev_position THEN 'improved'
    WHEN tw.position > lw.prev_position THEN 'declined'
    ELSE 'unchanged' END AS movement,
  tw.shop_date
FROM this_week tw
LEFT JOIN last_week lw USING (comp_id, channel, search_destination, sort_order)
JOIN revenue.competitor_property cp ON cp.comp_id = tw.comp_id;

CREATE OR REPLACE VIEW revenue.ranking_history_30d AS
SELECT 
  cp.comp_id, cp.property_name, cp.is_self,
  cpr.channel, cpr.search_destination, cpr.sort_order,
  cpr.shop_date, cpr.position, cpr.total_results,
  cpr.is_above_fold, cpr.is_first_page,
  cpr.has_sponsored_badge, cpr.has_genius_badge
FROM revenue.competitor_platform_rankings cpr
JOIN revenue.competitor_property cp ON cp.comp_id = cpr.comp_id
WHERE cpr.shop_date >= CURRENT_DATE - 30
ORDER BY cp.is_self DESC, cp.property_name, cpr.channel, cpr.sort_order, cpr.shop_date;

CREATE OR REPLACE VIEW revenue.rate_plan_history_30d AS
SELECT 
  cp.property_name, cp.is_self, cp.comp_id,
  crp.channel, crp.taxonomy_code, t.display_name AS plan_name, t.category,
  crp.shop_date, crp.stay_date,
  ROUND(AVG(crp.rate_usd), 2) AS avg_rate_usd,
  COUNT(*) AS observation_count,
  BOOL_OR(crp.has_strikethrough) AS had_promo,
  ROUND(AVG(crp.discount_pct) FILTER (WHERE crp.has_strikethrough), 1) AS avg_discount_pct
FROM revenue.competitor_rate_plans crp
JOIN revenue.competitor_property cp ON cp.comp_id = crp.comp_id
JOIN revenue.rate_plan_taxonomy t ON t.taxonomy_code = crp.taxonomy_code
WHERE crp.shop_date >= CURRENT_DATE - 30 AND crp.scrape_status = 'success'
GROUP BY cp.property_name, cp.is_self, cp.comp_id, crp.channel, crp.taxonomy_code, t.display_name, t.category, crp.shop_date, crp.stay_date
ORDER BY cp.is_self DESC, cp.property_name, crp.channel, t.display_name, crp.shop_date;
