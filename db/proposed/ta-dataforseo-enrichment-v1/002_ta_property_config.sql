-- TripAdvisor property config — stores the url_path discovered via DataForSEO search.
-- The url_path is the stable DataForSEO key for a property's TA listing
-- (e.g. /Hotel_Review-g294090-d12345678-Reviews-Namkhan-Luang_Prabang.html).
-- Discovered once by /api/cron/ta-urlpath-discover and cached here permanently.
--
-- Apply via Supabase MCP: apply_migration
-- Brief: ta-dataforseo-enrichment-v1

CREATE TABLE IF NOT EXISTS marketing.ta_property_config (
  property_id   integer PRIMARY KEY,
  url_path      text,            -- DataForSEO TA url_path for this property
  discovered_at timestamptz,
  raw           jsonb            -- full DataForSEO search result item
);

REVOKE ALL ON marketing.ta_property_config FROM anon;
GRANT ALL ON marketing.ta_property_config TO service_role;
GRANT SELECT ON marketing.ta_property_config TO authenticated;
