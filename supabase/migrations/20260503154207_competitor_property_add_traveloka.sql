-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503154207
-- Name:    competitor_property_add_traveloka
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


ALTER TABLE revenue.competitor_property
  ADD COLUMN IF NOT EXISTS traveloka_url text,
  ADD COLUMN IF NOT EXISTS traveloka_property_id text;
