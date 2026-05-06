-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502232248
-- Name:    phase1_18_property_profile_location_climate
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

ALTER TABLE marketing.property_profile
  ADD COLUMN IF NOT EXISTS airport_distance_km        numeric(5,1),
  ADD COLUMN IF NOT EXISTS airport_drive_time_min     int,
  ADD COLUMN IF NOT EXISTS train_distance_km          numeric(5,1),
  ADD COLUMN IF NOT EXISTS train_drive_time_min       int,
  ADD COLUMN IF NOT EXISTS bus_drive_time_min         int,
  ADD COLUMN IF NOT EXISTS timezone                   text,
  ADD COLUMN IF NOT EXISTS climate_temp_min_c         int,
  ADD COLUMN IF NOT EXISTS climate_temp_max_c         int,
  ADD COLUMN IF NOT EXISTS climate_rainy_months       text,
  ADD COLUMN IF NOT EXISTS climate_summary            text,
  ADD COLUMN IF NOT EXISTS shuttle_available          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shuttle_description        text,
  ADD COLUMN IF NOT EXISTS google_maps_url            text;