-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503151704
-- Name:    rate_shop_competitor_property_columns
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Add missing OTA URL fields, identifiers, and self-reference flag to competitor_property
ALTER TABLE revenue.competitor_property
  ADD COLUMN IF NOT EXISTS agoda_url text,
  ADD COLUMN IF NOT EXISTS agoda_property_id text,
  ADD COLUMN IF NOT EXISTS trip_url text,
  ADD COLUMN IF NOT EXISTS trip_property_id text,
  ADD COLUMN IF NOT EXISTS direct_url text,
  ADD COLUMN IF NOT EXISTS room_type_target text,
  ADD COLUMN IF NOT EXISTS is_self boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS scrape_priority smallint DEFAULT 5;

COMMENT ON COLUMN revenue.competitor_property.is_self IS 'True for The Namkhan self-reference row. Used by rate-shop agent to anchor comparisons.';
COMMENT ON COLUMN revenue.competitor_property.room_type_target IS 'Comp room type to match against our reference room (e.g. deluxe river view). Free text for now, agent uses fuzzy match.';
COMMENT ON COLUMN revenue.competitor_property.scrape_priority IS '1=daily must-scrape, 5=optional. Used to throttle Nimble cost on scaled runs.';
COMMENT ON COLUMN revenue.competitor_property.direct_url IS 'Hotel direct booking engine URL (Cloudbeds, SiteMinder, SynXis, Bookassist, etc.)';
