-- TripAdvisor subcategory ratings table for DataForSEO enrichment.
-- Stores aggregated per-property subcategory scores from each weekly pull.
-- One row per property per scrape run. v_ta_subcategory_latest picks the newest.
--
-- Apply via Supabase MCP: apply_migration
-- Brief: ta-dataforseo-enrichment-v1

CREATE TABLE IF NOT EXISTS marketing.mkt_ta_subcategory_ratings (
  id                    bigserial PRIMARY KEY,
  property_id           integer NOT NULL,
  scraped_at            timestamptz NOT NULL DEFAULT now(),
  total_reviews_pulled  integer,
  avg_rating            numeric(3,2),
  value_rating          numeric(3,2),
  rooms_rating          numeric(3,2),
  location_rating       numeric(3,2),
  cleanliness_rating    numeric(3,2),
  service_rating        numeric(3,2),
  sleep_quality_rating  numeric(3,2),
  raw                   jsonb          -- full aggregated bucket for debugging
);

REVOKE ALL ON marketing.mkt_ta_subcategory_ratings FROM anon;
GRANT SELECT, INSERT ON marketing.mkt_ta_subcategory_ratings TO service_role;
GRANT SELECT ON marketing.mkt_ta_subcategory_ratings TO authenticated;

-- Latest subcategory ratings per property (DISTINCT ON newest scrape)
CREATE OR REPLACE VIEW public.v_ta_subcategory_latest AS
SELECT DISTINCT ON (property_id)
  property_id,
  scraped_at,
  total_reviews_pulled,
  avg_rating,
  value_rating,
  rooms_rating,
  location_rating,
  cleanliness_rating,
  service_rating,
  sleep_quality_rating
FROM marketing.mkt_ta_subcategory_ratings
ORDER BY property_id, scraped_at DESC;

REVOKE ALL ON public.v_ta_subcategory_latest FROM anon;
GRANT SELECT ON public.v_ta_subcategory_latest TO authenticated, service_role;
