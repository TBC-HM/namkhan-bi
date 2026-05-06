-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504211741
-- Name:    2026_05_04_parity_matrix_view
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Lighthouse-style parity matrix per stay date, BDC channel.
-- Names which comps are undercutting Namkhan (the "loss channels" equivalent for single-channel scrape).
CREATE OR REPLACE VIEW public.v_parity_matrix AS
WITH latest_per_comp AS (
  SELECT DISTINCT ON (cr.comp_id, cr.stay_date)
         cr.comp_id, cr.stay_date, cr.rate_usd, cr.shop_date,
         cr.scrape_status, cp.property_name, cp.is_self
  FROM revenue.competitor_rates cr
  JOIN revenue.competitor_property cp ON cp.comp_id = cr.comp_id
  WHERE cr.channel = 'booking'
    AND cp.is_active
    AND cp.set_id IN (SELECT set_id FROM revenue.competitor_set WHERE is_primary = true)
  ORDER BY cr.comp_id, cr.stay_date, cr.shop_date DESC
),
self_row AS (
  SELECT stay_date, rate_usd AS namkhan_usd, shop_date
  FROM latest_per_comp WHERE is_self
),
comps AS (
  SELECT
    stay_date,
    ROUND(AVG(rate_usd)::numeric, 2)        AS comp_median_usd,
    MIN(rate_usd)                            AS comp_lowest_usd,
    MAX(rate_usd)                            AS comp_highest_usd,
    COUNT(*) FILTER (WHERE rate_usd IS NOT NULL) AS comps_with_price,
    COUNT(*) FILTER (WHERE scrape_status = 'no_availability') AS comps_sold_out,
    array_agg(property_name ORDER BY rate_usd) FILTER (WHERE rate_usd IS NOT NULL) AS comps_sorted_cheapest_first
  FROM latest_per_comp
  WHERE NOT is_self
  GROUP BY stay_date
)
SELECT
  COALESCE(s.stay_date, c.stay_date) AS stay_date,
  s.namkhan_usd,
  s.shop_date AS namkhan_shop_date,
  c.comp_median_usd, c.comp_lowest_usd, c.comp_highest_usd,
  c.comps_with_price, c.comps_sold_out,
  -- Comps that are CHEAPER than Namkhan (= undercutting)
  CASE WHEN s.namkhan_usd IS NOT NULL THEN
    (
      SELECT array_agg(t.name)
      FROM (
        SELECT lpc.property_name AS name, lpc.rate_usd AS r
        FROM latest_per_comp lpc
        WHERE NOT lpc.is_self
          AND lpc.stay_date = COALESCE(s.stay_date, c.stay_date)
          AND lpc.rate_usd IS NOT NULL
          AND lpc.rate_usd < s.namkhan_usd
        ORDER BY lpc.rate_usd
      ) t
    )
  ELSE NULL END AS comps_undercutting,
  CASE WHEN s.namkhan_usd IS NOT NULL THEN
    (
      SELECT COUNT(*)::int
      FROM latest_per_comp lpc
      WHERE NOT lpc.is_self
        AND lpc.stay_date = COALESCE(s.stay_date, c.stay_date)
        AND lpc.rate_usd IS NOT NULL
        AND lpc.rate_usd < s.namkhan_usd
    )
  ELSE 0 END AS num_comps_undercutting,
  CASE
    WHEN s.namkhan_usd IS NOT NULL AND c.comp_lowest_usd IS NOT NULL AND c.comp_lowest_usd > 0 THEN
      ROUND(((s.namkhan_usd - c.comp_lowest_usd) / c.comp_lowest_usd * 100)::numeric, 1)
    ELSE NULL
  END AS pct_vs_cheapest_comp
FROM self_row s
FULL OUTER JOIN comps c USING (stay_date)
WHERE COALESCE(s.stay_date, c.stay_date) IS NOT NULL
ORDER BY stay_date;

GRANT SELECT ON public.v_parity_matrix TO anon, authenticated, service_role;
