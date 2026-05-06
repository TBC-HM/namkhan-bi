-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505154423
-- Name:    b27_fix_alerts_sent_schema_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B27: kpi.check_freshness inserts severity/subject/body but alerts.sent only has message.
-- Add missing columns so the watchdog can alert.
ALTER TABLE alerts.sent
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body text;

-- Sanity-check: re-run the freshness check now to see if it succeeds
COMMENT ON TABLE alerts.sent IS 'Alert dispatch log. Columns: severity (low/med/high), subject, body added 2026-05-05 to match kpi.check_freshness expectations.';