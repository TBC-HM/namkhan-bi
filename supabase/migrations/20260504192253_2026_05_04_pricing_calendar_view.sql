-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504192253
-- Name:    2026_05_04_pricing_calendar_view
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Per-stay-date pricing calendar feed.
-- Namkhan BDC rate (latest shop) + comp set median (latest shop) per stay date.
-- Source for the new Lighthouse-style calendar on /revenue/pricing.

CREATE OR REPLACE VIEW public.v_pricing_calendar AS
WITH latest_per_comp AS (
  SELECT DISTINCT ON (cr.comp_id, cr.stay_date)
         cr.comp_id, cr.stay_date, cr.rate_usd, cr.shop_date,
         cr.is_refundable, cr.scrape_status
  FROM revenue.competitor_rates cr
  WHERE cr.channel = 'booking'
  ORDER BY cr.comp_id, cr.stay_date, cr.shop_date DESC
),
self_rates AS (
  SELECT lpc.stay_date,
         lpc.rate_usd          AS namkhan_usd,
         lpc.shop_date         AS namkhan_shop_date,
         lpc.is_refundable     AS namkhan_is_refundable,
         lpc.scrape_status     AS namkhan_status
  FROM latest_per_comp lpc
  JOIN revenue.competitor_property cp USING (comp_id)
  WHERE cp.is_self = true
),
comp_rates AS (
  SELECT lpc.stay_date,
         ROUND(AVG(lpc.rate_usd)::numeric, 2)        AS avg_usd,
         ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY lpc.rate_usd)::numeric, 2) AS median_usd,
         MIN(lpc.rate_usd)                            AS min_usd,
         MAX(lpc.rate_usd)                            AS max_usd,
         COUNT(*) FILTER (WHERE lpc.rate_usd IS NOT NULL) AS comp_count_with_price,
         COUNT(*) FILTER (WHERE lpc.scrape_status = 'no_availability') AS comp_count_sold_out
  FROM latest_per_comp lpc
  JOIN revenue.competitor_property cp USING (comp_id)
  WHERE cp.is_self = false
  GROUP BY lpc.stay_date
)
SELECT
  COALESCE(s.stay_date, c.stay_date) AS stay_date,
  s.namkhan_usd,
  s.namkhan_shop_date,
  s.namkhan_is_refundable,
  s.namkhan_status,
  c.avg_usd, c.median_usd, c.min_usd, c.max_usd,
  c.comp_count_with_price, c.comp_count_sold_out,
  CASE WHEN s.namkhan_usd IS NOT NULL AND c.median_usd IS NOT NULL AND c.median_usd > 0
       THEN ROUND(((s.namkhan_usd - c.median_usd) / c.median_usd * 100)::numeric, 1)
       ELSE NULL END AS pct_vs_comp_median,
  CASE WHEN s.namkhan_usd IS NOT NULL AND c.min_usd IS NOT NULL AND c.min_usd > 0
       THEN ROUND(((s.namkhan_usd - c.min_usd) / c.min_usd * 100)::numeric, 1)
       ELSE NULL END AS pct_vs_comp_cheapest
FROM self_rates s
FULL OUTER JOIN comp_rates c USING (stay_date)
WHERE COALESCE(s.stay_date, c.stay_date) IS NOT NULL
ORDER BY stay_date;

GRANT SELECT ON public.v_pricing_calendar TO anon, authenticated, service_role;
