-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503172210
-- Name:    compset_property_summary_with_reviews_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


DROP VIEW IF EXISTS revenue.compset_property_summary CASCADE;

CREATE VIEW revenue.compset_property_summary AS
WITH latest_rates AS (
  SELECT DISTINCT ON (cr.comp_id, cr.channel)
    cr.comp_id, cr.channel, cr.rate_usd, cr.shop_date, cr.stay_date, cr.is_available
  FROM revenue.competitor_rates cr
  WHERE cr.scrape_status = 'success' AND cr.rate_usd IS NOT NULL
  ORDER BY cr.comp_id, cr.channel, cr.shop_date DESC, cr.stay_date ASC
),
property_latest AS (
  SELECT DISTINCT ON (comp_id) comp_id, rate_usd AS latest_usd, channel AS latest_channel, shop_date AS last_shop_date
  FROM latest_rates WHERE is_available = true
  ORDER BY comp_id, shop_date DESC, rate_usd ASC
),
thirty_day_stats AS (
  SELECT cr.comp_id, AVG(cr.rate_usd) AS avg_30d_usd, COUNT(*) AS obs_count_30d, 
         MIN(cr.rate_usd) AS min_30d_usd, MAX(cr.rate_usd) AS max_30d_usd
  FROM revenue.competitor_rates cr
  WHERE cr.scrape_status = 'success' AND cr.rate_usd IS NOT NULL 
    AND cr.shop_date >= (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY cr.comp_id
),
median_calc AS (
  SELECT cp.set_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pl.latest_usd) AS set_median_usd
  FROM revenue.competitor_property cp JOIN property_latest pl ON pl.comp_id = cp.comp_id
  WHERE cp.is_active = true GROUP BY cp.set_id
)
SELECT 
  cp.comp_id, cp.set_id, cs.set_name, cs.set_type, cp.property_name, cp.is_self, cp.scrape_priority,
  cp.star_rating, cp.rooms, 
  cp.bdc_url, cp.agoda_url, cp.expedia_url, cp.trip_url, cp.direct_url,
  (cp.bdc_url IS NOT NULL) AS has_bdc,
  (cp.agoda_url IS NOT NULL) AS has_agoda,
  (cp.expedia_url IS NOT NULL) AS has_expedia,
  (cp.trip_url IS NOT NULL) AS has_trip,
  (cp.direct_url IS NOT NULL) AS has_direct,
  rs.weighted_score AS review_score,
  rs.total_reviews AS review_count,
  rs.channels_with_reviews,
  rs.by_channel AS reviews_by_channel,
  pl.latest_usd, pl.latest_channel, pl.last_shop_date,
  ROUND(tds.avg_30d_usd, 2) AS avg_30d_usd, COALESCE(tds.obs_count_30d, 0) AS obs_count_30d,
  ROUND(tds.min_30d_usd, 2) AS min_30d_usd, ROUND(tds.max_30d_usd, 2) AS max_30d_usd,
  CASE WHEN pl.latest_usd IS NOT NULL AND mc.set_median_usd IS NOT NULL 
    THEN ROUND(((pl.latest_usd - mc.set_median_usd) / mc.set_median_usd * 100)::numeric, 1)
    ELSE NULL END AS pct_vs_median,
  CASE WHEN pl.last_shop_date IS NULL THEN 'never'
    WHEN pl.last_shop_date >= CURRENT_DATE THEN 'today'
    WHEN pl.last_shop_date >= CURRENT_DATE - 1 THEN 'yesterday'
    WHEN pl.last_shop_date >= CURRENT_DATE - 7 THEN (CURRENT_DATE - pl.last_shop_date) || 'd ago'
    ELSE pl.last_shop_date::text END AS last_shop_human
FROM revenue.competitor_property cp
JOIN revenue.competitor_set cs ON cs.set_id = cp.set_id
LEFT JOIN property_latest pl ON pl.comp_id = cp.comp_id
LEFT JOIN thirty_day_stats tds ON tds.comp_id = cp.comp_id
LEFT JOIN median_calc mc ON mc.set_id = cp.set_id
LEFT JOIN revenue.competitor_reviews_summary rs ON rs.comp_id = cp.comp_id
WHERE cp.is_active = true
ORDER BY cs.set_name, cp.is_self DESC, cp.scrape_priority NULLS LAST, cp.property_name;

CREATE OR REPLACE VIEW revenue.competitor_rate_matrix AS
SELECT DISTINCT ON (cr.comp_id, cr.stay_date, cr.channel)
  cr.comp_id, cr.stay_date, cr.channel, cr.rate_usd, cr.is_available, cr.is_refundable,
  cr.shop_date, cr.scrape_status, cr.agent_run_id,
  to_char(cr.stay_date, 'Dy DD Mon') AS display_date,
  dc.events, dc.event_score
FROM revenue.competitor_rates cr
LEFT JOIN revenue.demand_calendar dc ON dc.cal_date = cr.stay_date
WHERE cr.scrape_status IN ('success','no_availability')
ORDER BY cr.comp_id, cr.stay_date, cr.channel, cr.shop_date DESC;
