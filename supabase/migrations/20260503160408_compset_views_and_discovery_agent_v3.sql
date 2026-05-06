-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503160408
-- Name:    compset_views_and_discovery_agent_v3
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Views (idempotent)
CREATE OR REPLACE VIEW revenue.compset_property_summary AS
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
  SELECT cr.comp_id, AVG(cr.rate_usd) AS avg_30d_usd, COUNT(*) AS obs_count_30d, MIN(cr.rate_usd) AS min_30d_usd, MAX(cr.rate_usd) AS max_30d_usd
  FROM revenue.competitor_rates cr
  WHERE cr.scrape_status = 'success' AND cr.rate_usd IS NOT NULL AND cr.shop_date >= (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY cr.comp_id
),
median_calc AS (
  SELECT cp.set_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pl.latest_usd) AS set_median_usd
  FROM revenue.competitor_property cp JOIN property_latest pl ON pl.comp_id = cp.comp_id
  WHERE cp.is_active = true GROUP BY cp.set_id
)
SELECT 
  cp.comp_id, cp.set_id, cs.set_name, cs.set_type, cp.property_name, cp.is_self, cp.scrape_priority,
  cp.star_rating, cp.rooms, cp.bdc_url, cp.agoda_url, cp.expedia_url, cp.trip_url, cp.direct_url,
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
WHERE cp.is_active = true
ORDER BY cs.set_name, cp.is_self DESC, cp.scrape_priority NULLS LAST, cp.property_name;

CREATE OR REPLACE VIEW revenue.compset_set_summary AS
SELECT 
  cs.set_id, cs.set_name, cs.set_type, cs.is_primary, cs.created_at,
  COUNT(cp.comp_id) FILTER (WHERE cp.is_active) AS property_count,
  COUNT(cp.comp_id) FILTER (WHERE cp.is_active AND cp.is_self) AS self_count,
  COUNT(DISTINCT cr.shop_date) FILTER (WHERE cr.shop_date >= CURRENT_DATE - 7) AS shop_days_last_7,
  MAX(cr.shop_date) AS last_shop_date,
  COUNT(cr.rate_id) FILTER (WHERE cr.scrape_status = 'success' AND cr.shop_date >= CURRENT_DATE - 7) AS successful_obs_7d,
  COUNT(cr.rate_id) FILTER (WHERE cr.scrape_status != 'success' AND cr.shop_date >= CURRENT_DATE - 7) AS failed_obs_7d,
  CASE WHEN COUNT(cr.rate_id) FILTER (WHERE cr.shop_date >= CURRENT_DATE - 7) = 0 THEN 'no_data'
    WHEN MAX(cr.shop_date) >= CURRENT_DATE - 1 THEN 'fresh'
    WHEN MAX(cr.shop_date) >= CURRENT_DATE - 3 THEN 'stale'
    ELSE 'very_stale' END AS data_freshness
FROM revenue.competitor_set cs
LEFT JOIN revenue.competitor_property cp ON cp.set_id = cs.set_id AND cp.is_active = true
LEFT JOIN revenue.competitor_rates cr ON cr.comp_id = cp.comp_id
GROUP BY cs.set_id, cs.set_name, cs.set_type, cs.is_primary, cs.created_at;

CREATE OR REPLACE VIEW governance.agent_run_summary AS
SELECT 
  ar.run_id, ar.agent_id, a.code AS agent_code, a.name AS agent_name,
  ar.started_at, ar.finished_at, ar.status, ar.duration_ms,
  ar.tokens_in, ar.tokens_out, ar.cost_usd, ar.proposals_created, ar.error_message,
  EXTRACT(EPOCH FROM (NOW() - ar.started_at))/60 AS minutes_ago
FROM governance.agent_runs ar
JOIN governance.agents a ON a.agent_id = ar.agent_id
ORDER BY ar.started_at DESC;

-- comp_discovery_agent — using valid status 'planned'
INSERT INTO governance.agents (agent_id, code, name, pillar, description, status, model_id, monthly_budget_usd, config, created_at)
VALUES (
  gen_random_uuid(), 'comp_discovery_agent', 'Comp Discovery Agent', 'revenue',
  'Discovers candidate competitor properties for AI-proposed sets via web search and similarity scoring. Writes to governance.proposals for human approval before rates are scraped.',
  'planned', 'claude-sonnet-4-6', 20.00,
  jsonb_build_object(
    'mode', 'human_in_loop',
    'discovery_scope', jsonb_build_array('local_lp', 'regional_sea'),
    'max_candidates_per_run', 10,
    'similarity_factors', jsonb_build_array('star_rating', 'room_count_range', 'price_band', 'amenities_overlap', 'guest_segment'),
    'phase', 'phase_2_pending'
  ),
  NOW()
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  config = EXCLUDED.config, updated_at = NOW();
