-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505160852
-- Name:    phase_3_3b_revenue_schema_tenant
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 3.3b — Tenant-scope revenue.* schema
-- 
-- Three groups:
-- A) Direct property_id (ota_uploads, demand_calendar, scoring_config_audit,
--    rate_plan_taxonomy, channel_contacts, profile_crawls, plus all v1 bdc_*)
-- B) FK-derived from revenue.ota_uploads (all bdc_*_v2 children)
-- C) FK-derived from revenue.competitor_property (rate_plans, reviews, rankings,
--    parity_breaches, parity_observations)
-- D) FK-derived from revenue.profile_crawls -> profile_recommendations -> profile_measurements
-- E) FK-derived from revenue.scoring_config -> scoring_config_audit
-- =====================================================================

-- ---------------------------------------------------------------------
-- GROUP A: add property_id directly
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  group_a text[] := ARRAY[
    'ota_uploads',
    'demand_calendar',
    'rate_plan_taxonomy',
    'channel_contacts',
    'profile_crawls',
    -- All v1 bdc_* with no FK chain
    'bdc_alert_state',
    'bdc_book_window_insights',
    'bdc_country_insights',
    'bdc_demand_insights',
    'bdc_genius_monthly',
    'bdc_pace_monthly',
    'bdc_pace_room_rate',
    'bdc_ranking_snapshot'
  ];
BEGIN
  FOREACH tbl IN ARRAY group_a LOOP
    EXECUTE format('ALTER TABLE revenue.%I ADD COLUMN IF NOT EXISTS property_id BIGINT', tbl);
    EXECUTE format('UPDATE revenue.%I SET property_id = 260955 WHERE property_id IS NULL', tbl);
    EXECUTE format('ALTER TABLE revenue.%I ALTER COLUMN property_id SET NOT NULL', tbl);
    EXECUTE format('ALTER TABLE revenue.%I DROP CONSTRAINT IF EXISTS %I',
                   tbl, tbl || '_property_id_fk');
    EXECUTE format('ALTER TABLE revenue.%I ADD CONSTRAINT %I FOREIGN KEY (property_id) REFERENCES core.properties(property_id)',
                   tbl, tbl || '_property_id_fk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON revenue.%I(property_id)',
                   tbl || '_property_id_idx', tbl);

    EXECUTE format('ALTER TABLE revenue.%I ENABLE ROW LEVEL SECURITY', tbl);
    -- Drop any pre-existing policies for clean slate
    -- (no DROP needed - none of these had policies, but safe pattern)

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON revenue.%I',
      tbl || '_tenant', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON revenue.%I FOR ALL TO authenticated
        USING (core.has_property_access(property_id))
        WITH CHECK (core.has_property_access(property_id))',
      tbl || '_tenant', tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON revenue.%I',
      tbl || '_service', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON revenue.%I FOR ALL TO service_role
        USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- GROUP B: FK-derived from revenue.ota_uploads via upload_id
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  group_b text[] := ARRAY[
    'bdc_self_summary',
    'bdc_country_insights_v2',
    'bdc_book_window_insights_v2',
    'bdc_demand_insights_v2',
    'bdc_genius_monthly_v2',
    'bdc_pace_monthly_v2',
    'bdc_pace_room_rate_v2',
    'bdc_ranking_snapshot_v2',
    'bdc_promotions',
    'bdc_reservations'
  ];
BEGIN
  FOREACH tbl IN ARRAY group_b LOOP
    EXECUTE format('ALTER TABLE revenue.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON revenue.%I', tbl || '_tenant', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON revenue.%I FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM revenue.ota_uploads u
          WHERE u.id = %I.upload_id
            AND core.has_property_access(u.property_id)
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM revenue.ota_uploads u
          WHERE u.id = %I.upload_id
            AND core.has_property_access(u.property_id)
        ))',
      tbl || '_tenant', tbl, tbl, tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON revenue.%I', tbl || '_service', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON revenue.%I FOR ALL TO service_role
        USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- GROUP C: FK-derived from revenue.competitor_property via comp_id
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  pol record;
  group_c text[] := ARRAY[
    'competitor_rate_plans',
    'competitor_reviews',
    'competitor_platform_rankings',
    'parity_breaches',
    'parity_observations'
  ];
BEGIN
  FOREACH tbl IN ARRAY group_c LOOP
    EXECUTE format('ALTER TABLE revenue.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Wipe existing policies (some had USING(true) leftovers)
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='revenue' AND tablename=tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON revenue.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON revenue.%I FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM revenue.competitor_property cp
          WHERE cp.comp_id = %I.comp_id
            AND core.has_property_access(cp.property_id)
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM revenue.competitor_property cp
          WHERE cp.comp_id = %I.comp_id
            AND core.has_property_access(cp.property_id)
        ))',
      tbl || '_tenant', tbl, tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON revenue.%I FOR ALL TO service_role
        USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- GROUP D: profile_recommendations FK-derived from profile_crawls
--          profile_measurements FK-derived from profile_recommendations -> profile_crawls
-- ---------------------------------------------------------------------
ALTER TABLE revenue.profile_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_recommendations_tenant ON revenue.profile_recommendations;
CREATE POLICY profile_recommendations_tenant ON revenue.profile_recommendations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM revenue.profile_crawls pc
    WHERE pc.id = profile_recommendations.crawl_id
      AND core.has_property_access(pc.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM revenue.profile_crawls pc
    WHERE pc.id = profile_recommendations.crawl_id
      AND core.has_property_access(pc.property_id)
  ));
DROP POLICY IF EXISTS profile_recommendations_service ON revenue.profile_recommendations;
CREATE POLICY profile_recommendations_service ON revenue.profile_recommendations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE revenue.profile_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_measurements_tenant ON revenue.profile_measurements;
CREATE POLICY profile_measurements_tenant ON revenue.profile_measurements
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM revenue.profile_recommendations pr
    JOIN revenue.profile_crawls pc ON pc.id = pr.crawl_id
    WHERE pr.id = profile_measurements.recommendation_id
      AND core.has_property_access(pc.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM revenue.profile_recommendations pr
    JOIN revenue.profile_crawls pc ON pc.id = pr.crawl_id
    WHERE pr.id = profile_measurements.recommendation_id
      AND core.has_property_access(pc.property_id)
  ));
DROP POLICY IF EXISTS profile_measurements_service ON revenue.profile_measurements;
CREATE POLICY profile_measurements_service ON revenue.profile_measurements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- GROUP E: scoring_config_audit FK-derived from scoring_config
-- ---------------------------------------------------------------------
ALTER TABLE revenue.scoring_config_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scoring_config_audit_tenant ON revenue.scoring_config_audit;
CREATE POLICY scoring_config_audit_tenant ON revenue.scoring_config_audit
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM revenue.scoring_config sc
    WHERE sc.config_id = scoring_config_audit.config_id
      AND core.has_property_access(sc.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM revenue.scoring_config sc
    WHERE sc.config_id = scoring_config_audit.config_id
      AND core.has_property_access(sc.property_id)
  ));
DROP POLICY IF EXISTS scoring_config_audit_service ON revenue.scoring_config_audit;
CREATE POLICY scoring_config_audit_service ON revenue.scoring_config_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);
