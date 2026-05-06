-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503175656
-- Name:    analytics_insight_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- VIEW: data maturity status
-- Replaces "Day 4 of 30" hardcoded banner
-- ============================================================
CREATE OR REPLACE VIEW revenue.data_maturity AS
WITH stats AS (
  SELECT
    COUNT(DISTINCT cr.shop_date) AS distinct_shop_days,
    MIN(cr.shop_date) AS first_shop_date,
    MAX(cr.shop_date) AS last_shop_date,
    COUNT(*) AS total_observations,
    COUNT(DISTINCT cr.comp_id) AS properties_with_data
  FROM revenue.competitor_rates cr
  WHERE cr.scrape_status = 'success'
)
SELECT
  distinct_shop_days,
  first_shop_date,
  last_shop_date,
  total_observations,
  properties_with_data,
  CASE
    WHEN distinct_shop_days = 0 THEN 'no_data'
    WHEN distinct_shop_days < 7 THEN 'bootstrapping'
    WHEN distinct_shop_days < 14 THEN 'baseline'
    WHEN distinct_shop_days < 30 THEN 'trends_emerging'
    ELSE 'mature'
  END AS maturity_stage,
  CASE
    WHEN distinct_shop_days = 0 THEN 'No scrapes yet. Run agent to begin.'
    WHEN distinct_shop_days < 7 THEN 'Day ' || distinct_shop_days || ' of 30 — bootstrapping. Snapshots only, no trends yet.'
    WHEN distinct_shop_days < 14 THEN 'Day ' || distinct_shop_days || ' of 30 — collecting baseline. Trends not yet reliable.'
    WHEN distinct_shop_days < 30 THEN 'Day ' || distinct_shop_days || ' of 30 — trends emerging. Anomaly detection at day 30.'
    ELSE 'Mature data — ' || distinct_shop_days || ' days of history.'
  END AS status_message,
  -- Capability flags for UI
  (distinct_shop_days >= 7) AS show_simple_trends,
  (distinct_shop_days >= 14) AS show_full_charts,
  (distinct_shop_days >= 30) AS show_anomaly_detection
FROM stats;

COMMENT ON VIEW revenue.data_maturity IS 'Computed data maturity stage. Powers the building/maturity banner. No hardcoded day counts.';

-- ============================================================
-- VIEW: rate plan gaps for Namkhan
-- Replaces "5 plan types are offered..." hardcoded prose
-- Returns one row per plan Namkhan does NOT offer that comps DO
-- Ranked by easiest_wins logic: high comp coverage + measurable discount
-- ============================================================
CREATE OR REPLACE VIEW revenue.rate_plan_gaps AS
WITH self_id AS (
  SELECT comp_id FROM revenue.competitor_property WHERE is_self = true LIMIT 1
),
namkhan_offers AS (
  SELECT DISTINCT taxonomy_code
  FROM revenue.competitor_rate_plans crp, self_id
  WHERE crp.comp_id = self_id.comp_id
    AND crp.scrape_status = 'success'
    AND crp.shop_date >= CURRENT_DATE - 14
),
comp_offers AS (
  SELECT 
    crp.taxonomy_code,
    COUNT(DISTINCT crp.comp_id) AS comps_count,
    ROUND(AVG(crp.discount_pct) FILTER (WHERE crp.has_strikethrough), 1) AS avg_discount,
    ROUND(AVG(crp.rate_usd), 2) AS avg_rate_usd,
    ARRAY_AGG(DISTINCT cp.property_name) FILTER (WHERE NOT cp.is_self) AS comps_offering_list
  FROM revenue.competitor_rate_plans crp
  JOIN revenue.competitor_property cp ON cp.comp_id = crp.comp_id
  WHERE crp.scrape_status = 'success' 
    AND crp.shop_date >= CURRENT_DATE - 14
    AND NOT cp.is_self
  GROUP BY crp.taxonomy_code
),
total_comps AS (
  SELECT COUNT(*)::numeric AS n FROM revenue.competitor_property WHERE is_active = true AND NOT is_self
)
SELECT
  t.taxonomy_code,
  t.display_name AS plan_name,
  t.category,
  co.comps_count,
  ROUND((co.comps_count / NULLIF(tc.n, 0) * 100)::numeric, 0) AS comp_coverage_pct,
  co.avg_discount,
  co.avg_rate_usd,
  co.comps_offering_list,
  -- Easy-win score: 50% comp coverage + 50% discount magnitude (deeper discount = bigger missed signal)
  ROUND(
    ((co.comps_count / NULLIF(tc.n, 0) * 50) +
     (LEAST(COALESCE(co.avg_discount, 0), 30) / 30 * 50))::numeric, 1
  ) AS easy_win_score
FROM comp_offers co
JOIN revenue.rate_plan_taxonomy t ON t.taxonomy_code = co.taxonomy_code
CROSS JOIN total_comps tc
WHERE co.taxonomy_code NOT IN (SELECT taxonomy_code FROM namkhan_offers)
ORDER BY easy_win_score DESC;

COMMENT ON VIEW revenue.rate_plan_gaps IS 'Plans comps offer but Namkhan does not. Ranked by easy_win_score (50% comp coverage + 50% discount magnitude). Powers gap insight cards.';

-- ============================================================
-- VIEW: promo behavior signals per competitor (last 30 days)
-- Replaces "Sofitel runs sustained 10-15%..." hardcoded prose
-- Computes deterministic pattern flags per property
-- ============================================================
CREATE OR REPLACE VIEW revenue.promo_behavior_signals AS
WITH per_property_30d AS (
  SELECT 
    cp.comp_id, cp.property_name, cp.is_self,
    -- Volume signals
    COUNT(DISTINCT crp.shop_date) AS days_with_data,
    COUNT(DISTINCT crp.shop_date) FILTER (WHERE crp.has_strikethrough) AS days_with_promo,
    -- Discount signals
    AVG(crp.discount_pct) FILTER (WHERE crp.has_strikethrough) AS avg_discount_when_promoted,
    MAX(crp.discount_pct) AS max_discount_seen,
    -- Burst detection: count of contiguous promo runs >= 5 days
    COUNT(*) FILTER (WHERE crp.has_strikethrough AND crp.discount_pct >= 20) AS aggressive_observations
  FROM revenue.competitor_property cp
  LEFT JOIN revenue.competitor_rate_plans crp ON crp.comp_id = cp.comp_id
    AND crp.shop_date >= CURRENT_DATE - 30
    AND crp.scrape_status = 'success'
  WHERE cp.is_active = true
  GROUP BY cp.comp_id, cp.property_name, cp.is_self
)
SELECT
  comp_id, property_name, is_self,
  days_with_data,
  days_with_promo,
  ROUND((days_with_promo::numeric / NULLIF(days_with_data, 0) * 100)::numeric, 0) AS promo_frequency_pct,
  ROUND(avg_discount_when_promoted::numeric, 1) AS avg_discount_pct,
  max_discount_seen,
  -- Pattern classification (deterministic rules)
  CASE
    WHEN days_with_data = 0 THEN 'no_data'
    WHEN days_with_promo = 0 THEN 'no_promos'
    WHEN days_with_promo::numeric / NULLIF(days_with_data, 0) >= 0.80 
      AND avg_discount_when_promoted < 15 THEN 'sustained_low_discount'
    WHEN days_with_promo::numeric / NULLIF(days_with_data, 0) >= 0.80 
      AND avg_discount_when_promoted >= 15 THEN 'sustained_aggressive'
    WHEN days_with_promo BETWEEN 5 AND 10 AND max_discount_seen >= 20 THEN 'flash_burst'
    WHEN days_with_promo::numeric / NULLIF(days_with_data, 0) BETWEEN 0.30 AND 0.79 THEN 'periodic'
    WHEN days_with_promo::numeric / NULLIF(days_with_data, 0) < 0.30 THEN 'occasional'
    ELSE 'unclassified'
  END AS pattern,
  -- Pre-formatted human label
  CASE
    WHEN days_with_data = 0 THEN 'No data yet'
    WHEN days_with_promo = 0 THEN 'No promo activity'
    WHEN days_with_promo::numeric / NULLIF(days_with_data, 0) >= 0.80 
      AND avg_discount_when_promoted < 15 
      THEN 'Sustained low-discount (' || ROUND(avg_discount_when_promoted::numeric, 0) || '% avg, ' 
        || days_with_promo || '/' || days_with_data || ' days)'
    WHEN days_with_promo::numeric / NULLIF(days_with_data, 0) >= 0.80 
      AND avg_discount_when_promoted >= 15 
      THEN 'Sustained aggressive (' || ROUND(avg_discount_when_promoted::numeric, 0) || '% avg, ' 
        || days_with_promo || '/' || days_with_data || ' days)'
    WHEN days_with_promo BETWEEN 5 AND 10 AND max_discount_seen >= 20 
      THEN 'Flash burst (' || days_with_promo || ' days, peak ' || max_discount_seen || '%)'
    WHEN days_with_promo::numeric / NULLIF(days_with_data, 0) BETWEEN 0.30 AND 0.79 
      THEN 'Periodic (' || days_with_promo || '/' || days_with_data || ' days, ' 
        || ROUND(avg_discount_when_promoted::numeric, 0) || '% avg)'
    ELSE 'Occasional (' || days_with_promo || '/' || days_with_data || ' days)'
  END AS pattern_label
FROM per_property_30d
ORDER BY is_self DESC, days_with_promo DESC, avg_discount_when_promoted DESC NULLS LAST;

COMMENT ON VIEW revenue.promo_behavior_signals IS 'Per-property promo pattern classification using deterministic rules. Replaces hardcoded narrative prose with structured signals.';

-- ============================================================
-- VIEW: namkhan vs comp avg by plan type (the "track $15 above" claim)
-- ============================================================
CREATE OR REPLACE VIEW revenue.namkhan_vs_comp_avg AS
WITH self_id AS (SELECT comp_id FROM revenue.competitor_property WHERE is_self = true LIMIT 1),
self_rates AS (
  SELECT crp.taxonomy_code, AVG(crp.rate_usd) AS self_avg_rate
  FROM revenue.competitor_rate_plans crp, self_id
  WHERE crp.comp_id = self_id.comp_id 
    AND crp.shop_date >= CURRENT_DATE - 14 
    AND crp.scrape_status = 'success'
  GROUP BY crp.taxonomy_code
),
comp_rates AS (
  SELECT crp.taxonomy_code, AVG(crp.rate_usd) AS comp_avg_rate, COUNT(DISTINCT crp.comp_id) AS comp_count
  FROM revenue.competitor_rate_plans crp
  JOIN revenue.competitor_property cp ON cp.comp_id = crp.comp_id
  WHERE NOT cp.is_self 
    AND crp.shop_date >= CURRENT_DATE - 14 
    AND crp.scrape_status = 'success'
  GROUP BY crp.taxonomy_code
)
SELECT
  t.taxonomy_code, t.display_name AS plan_name, t.category,
  ROUND(sr.self_avg_rate::numeric, 2) AS namkhan_avg_rate,
  ROUND(cr.comp_avg_rate::numeric, 2) AS comp_avg_rate,
  cr.comp_count AS comps_with_plan,
  ROUND((sr.self_avg_rate - cr.comp_avg_rate)::numeric, 2) AS price_diff_usd,
  ROUND(((sr.self_avg_rate - cr.comp_avg_rate) / NULLIF(cr.comp_avg_rate, 0) * 100)::numeric, 1) AS price_diff_pct,
  CASE
    WHEN sr.self_avg_rate IS NULL THEN 'we_dont_offer'
    WHEN cr.comp_avg_rate IS NULL THEN 'comps_dont_offer'
    WHEN ABS((sr.self_avg_rate - cr.comp_avg_rate) / NULLIF(cr.comp_avg_rate, 0) * 100) < 5 THEN 'aligned'
    WHEN sr.self_avg_rate > cr.comp_avg_rate THEN 'priced_above'
    ELSE 'priced_below'
  END AS positioning
FROM revenue.rate_plan_taxonomy t
LEFT JOIN self_rates sr ON sr.taxonomy_code = t.taxonomy_code
LEFT JOIN comp_rates cr ON cr.taxonomy_code = t.taxonomy_code
WHERE sr.self_avg_rate IS NOT NULL OR cr.comp_avg_rate IS NOT NULL
ORDER BY t.display_order;

COMMENT ON VIEW revenue.namkhan_vs_comp_avg IS 'Namkhan rate vs competitor average per plan type. Drives positioning insight (above/below/aligned). No prose.';
