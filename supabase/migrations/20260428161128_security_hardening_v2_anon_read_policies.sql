-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428161128
-- Name:    security_hardening_v2_anon_read_policies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- Security hardening v2: Add anon SELECT policies for tables the dashboard reads.
-- =============================================================================
-- Read-only is enforced because no INSERT/UPDATE/DELETE policies exist;
-- without those, anon cannot write — RLS deny-by-default.
-- This is property-scoped to property_id = 260955 to avoid leakage if the
-- DB is ever extended to multi-property.

-- Helper: standard property-scoped read policy
DO $$
BEGIN
  -- reservations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reservations' AND policyname='anon_read_namkhan') THEN
    CREATE POLICY anon_read_namkhan ON public.reservations
      FOR SELECT TO anon, authenticated
      USING (property_id = 260955);
  END IF;

  -- rate_plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rate_plans' AND policyname='anon_read_namkhan') THEN
    CREATE POLICY anon_read_namkhan ON public.rate_plans
      FOR SELECT TO anon, authenticated
      USING (property_id = 260955);
  END IF;

  -- house_accounts
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='house_accounts' AND policyname='anon_read_namkhan') THEN
    CREATE POLICY anon_read_namkhan ON public.house_accounts
      FOR SELECT TO anon, authenticated
      USING (property_id = 260955);
  END IF;

  -- rooms
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rooms' AND policyname='anon_read_namkhan') THEN
    CREATE POLICY anon_read_namkhan ON public.rooms
      FOR SELECT TO anon, authenticated
      USING (property_id = 260955);
  END IF;

  -- room_types
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='room_types' AND policyname='anon_read_namkhan') THEN
    CREATE POLICY anon_read_namkhan ON public.room_types
      FOR SELECT TO anon, authenticated
      USING (property_id = 260955);
  END IF;

  -- sources
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sources' AND policyname='anon_read_namkhan') THEN
    CREATE POLICY anon_read_namkhan ON public.sources
      FOR SELECT TO anon, authenticated
      USING (true);  -- sources isn't property-scoped, but it's reference data
  END IF;

  -- dq_known_issues (no property scope; small reference table)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dq_known_issues' AND policyname='anon_read') THEN
    CREATE POLICY anon_read ON public.dq_known_issues
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;

  -- operational_overrides (anyone can read; no writes via anon)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operational_overrides' AND policyname='anon_read') THEN
    CREATE POLICY anon_read ON public.operational_overrides
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;

  -- usali_category_map (small ref table; reads OK; not flagged but let's be tidy)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='usali_category_map' AND policyname='anon_read') THEN
    -- Only if RLS is enabled
    IF (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='usali_category_map') THEN
      CREATE POLICY anon_read ON public.usali_category_map
        FOR SELECT TO anon, authenticated
        USING (true);
    END IF;
  END IF;
END $$;

-- Tables NOT given anon access (intentional — sensitive or unused by dashboard):
--   transactions, reservation_rooms, guests, rate_inventory, add_ons,
--   tax_fee_records, adjustments, payment_methods, item_categories, items,
--   taxes_and_fees_config, groups, room_blocks, housekeeping_status,
--   custom_fields, communications, reservation_modifications,
--   data_insights_snapshots, market_segments, daily_metrics, channel_metrics,
--   sync_runs, sync_request_queue, sync_watermarks, hotels
-- The dashboard accesses these only via mat views (which already have GRANT SELECT TO anon).