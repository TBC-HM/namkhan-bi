-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503154219
-- Name:    competitor_rates_add_traveloka_channel
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Drop and recreate channel check to include traveloka
ALTER TABLE revenue.competitor_rates
  DROP CONSTRAINT IF EXISTS competitor_rates_channel_check;

ALTER TABLE revenue.competitor_rates
  ADD CONSTRAINT competitor_rates_channel_check
  CHECK (channel IN ('booking','agoda','expedia','trip','direct','google','hotels_com','traveloka'));
