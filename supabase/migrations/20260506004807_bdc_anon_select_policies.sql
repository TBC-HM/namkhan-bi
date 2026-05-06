-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506004807
-- Name:    bdc_anon_select_policies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Add permissive SELECT policies for anon + authenticated on all BDC tables.
-- These tables hold OTA aggregates + reservation-level metadata — no PII risk.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname='revenue' AND tablename LIKE 'bdc_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS bdc_read_anon ON revenue.%I', t);
    EXECUTE format('CREATE POLICY bdc_read_anon ON revenue.%I FOR SELECT TO anon, authenticated, service_role USING (true)', t);
  END LOOP;
END $$;

-- Same for the channel_contacts and ota_uploads + profile_* tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname='revenue'
      AND tablename IN ('channel_contacts','ota_uploads','profile_crawls','profile_recommendations','profile_measurements')
  LOOP
    EXECUTE format('ALTER TABLE revenue.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS bdc_read_anon ON revenue.%I', t);
    EXECUTE format('CREATE POLICY bdc_read_anon ON revenue.%I FOR SELECT TO anon, authenticated, service_role USING (true)', t);
  END LOOP;
END $$;