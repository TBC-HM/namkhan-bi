-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506101542
-- Name:    anon_read_revenue_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Grant anon SELECT on all revenue.* tables — these hold OTA aggregates + comp set data, no PII
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname='revenue'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE revenue.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS rev_read_anon ON revenue.%I', t);
      EXECUTE format('CREATE POLICY rev_read_anon ON revenue.%I FOR SELECT TO anon, authenticated, service_role USING (true)', t);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'skip %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;