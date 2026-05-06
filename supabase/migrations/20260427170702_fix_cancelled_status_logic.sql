-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427170702
-- Name:    fix_cancelled_status_logic
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Fix is_cancelled to handle both spellings
ALTER TABLE reservations DROP COLUMN IF EXISTS is_cancelled;
ALTER TABLE reservations ADD COLUMN is_cancelled boolean 
  GENERATED ALWAYS AS (status IN ('cancelled','canceled','no_show')) STORED;
