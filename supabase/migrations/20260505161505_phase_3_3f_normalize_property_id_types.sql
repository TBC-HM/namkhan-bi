-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505161505
-- Name:    phase_3_3f_normalize_property_id_types
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 3.3f — Normalize property_id types to BIGINT
-- Children of these tables depend on property_id via FK-derived RLS.
-- Drop children policies first.
-- =====================================================================

-- Drop child policies that depend on the parents we're about to alter
-- frontoffice.arrivals children
DROP POLICY IF EXISTS prearrival_messages_tenant ON frontoffice.prearrival_messages;
DROP POLICY IF EXISTS upsell_offers_tenant ON frontoffice.upsell_offers;
DROP POLICY IF EXISTS vip_briefs_tenant ON frontoffice.vip_briefs;
DROP POLICY IF EXISTS eta_tracking_tenant ON frontoffice.eta_tracking;
DROP POLICY IF EXISTS compliance_docs_tenant ON frontoffice.compliance_docs;

-- plan.scenarios children
DROP POLICY IF EXISTS lines_tenant ON plan.lines;
-- (plan.drivers had direct property_id added in 3.3e, no dependency)

-- compiler.runs children
DROP POLICY IF EXISTS deploys_tenant ON compiler.deploys;
-- (compiler.variants got direct property_id; FK-derive not needed)

-- web.sites children
DROP POLICY IF EXISTS pages_tenant ON web.pages;
DROP POLICY IF EXISTS posts_tenant ON web.posts;
DROP POLICY IF EXISTS retreats_tenant ON web.retreats;
DROP POLICY IF EXISTS series_tenant ON web.series;
DROP POLICY IF EXISTS pages_history_tenant ON web.pages_history;
DROP POLICY IF EXISTS retreats_versions_tenant ON web.retreats_versions;
DROP POLICY IF EXISTS configurations_tenant ON web.configurations;
DROP POLICY IF EXISTS ab_tests_tenant ON web.ab_tests;

-- ---------------------------------------------------------------------
-- Now do the type normalization
-- ---------------------------------------------------------------------
DO $$
DECLARE
  rec record;
  pol record;
  con record;
  affected text[][] := ARRAY[
    ARRAY['compiler','itinerary_templates'],
    ARRAY['compiler','runs'],
    ARRAY['frontoffice','arrivals'],
    ARRAY['plan','scenarios'],
    ARRAY['pricing','pricelist'],
    ARRAY['pricing','seasons'],
    ARRAY['web','sites']
  ];
  i int; s text; t text; coltype text;
BEGIN
  FOR i IN 1..array_length(affected, 1) LOOP
    s := affected[i][1]; t := affected[i][2];

    -- Drop policies on the table itself
    FOR pol IN EXECUTE format('SELECT policyname FROM pg_policies WHERE schemaname=%L AND tablename=%L', s, t) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, s, t);
    END LOOP;

    -- Drop FK constraints on property_id
    FOR con IN EXECUTE format(
      'SELECT conname FROM pg_constraint c
       WHERE c.conrelid = %L::regclass
         AND c.contype = %L
         AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND a.attname = %L)',
      s || '.' || t, 'f', 'property_id'
    ) LOOP
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', s, t, con.conname);
    END LOOP;

    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN property_id DROP DEFAULT', s, t);

    EXECUTE format('SELECT atttypid::regtype::text FROM pg_attribute
                    WHERE attrelid = %L::regclass AND attname = %L',
                   s || '.' || t, 'property_id') INTO coltype;

    IF coltype = 'text' THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ALTER COLUMN property_id TYPE BIGINT USING (CASE WHEN property_id ~ ''^\d+$'' THEN property_id::BIGINT ELSE 260955 END)',
        s, t
      );
    ELSIF coltype = 'integer' THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN property_id TYPE BIGINT', s, t);
    END IF;

    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN property_id SET DEFAULT 260955', s, t);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (property_id) REFERENCES core.properties(property_id)',
                   s, t, t || '_property_id_fk');
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', s, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO authenticated
        USING (core.has_property_access(property_id))
        WITH CHECK (core.has_property_access(property_id))',
      t || '_tenant', s, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service', s, t
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I(property_id)', t || '_property_id_idx', s, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Recreate child policies that we dropped above
-- ---------------------------------------------------------------------

-- frontoffice children → frontoffice.arrivals
CREATE POLICY prearrival_messages_tenant ON frontoffice.prearrival_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = prearrival_messages.arrival_id AND core.has_property_access(a.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = prearrival_messages.arrival_id AND core.has_property_access(a.property_id)));
CREATE POLICY upsell_offers_tenant ON frontoffice.upsell_offers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = upsell_offers.arrival_id AND core.has_property_access(a.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = upsell_offers.arrival_id AND core.has_property_access(a.property_id)));
CREATE POLICY vip_briefs_tenant ON frontoffice.vip_briefs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = vip_briefs.arrival_id AND core.has_property_access(a.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = vip_briefs.arrival_id AND core.has_property_access(a.property_id)));
CREATE POLICY eta_tracking_tenant ON frontoffice.eta_tracking FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = eta_tracking.arrival_id AND core.has_property_access(a.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = eta_tracking.arrival_id AND core.has_property_access(a.property_id)));
CREATE POLICY compliance_docs_tenant ON frontoffice.compliance_docs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = compliance_docs.arrival_id AND core.has_property_access(a.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM frontoffice.arrivals a WHERE a.id = compliance_docs.arrival_id AND core.has_property_access(a.property_id)));

-- plan.lines → plan.scenarios
CREATE POLICY lines_tenant ON plan.lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM plan.scenarios sc WHERE sc.scenario_id = lines.scenario_id AND core.has_property_access(sc.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM plan.scenarios sc WHERE sc.scenario_id = lines.scenario_id AND core.has_property_access(sc.property_id)));

-- compiler.deploys → compiler.runs
CREATE POLICY deploys_tenant ON compiler.deploys FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM compiler.runs r WHERE r.id = deploys.run_id AND core.has_property_access(r.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM compiler.runs r WHERE r.id = deploys.run_id AND core.has_property_access(r.property_id)));

-- web.* children → web.sites
CREATE POLICY pages_tenant ON web.pages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.sites s WHERE s.id = pages.site_id AND core.has_property_access(s.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.sites s WHERE s.id = pages.site_id AND core.has_property_access(s.property_id)));
CREATE POLICY posts_tenant ON web.posts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.sites s WHERE s.id = posts.site_id AND core.has_property_access(s.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.sites s WHERE s.id = posts.site_id AND core.has_property_access(s.property_id)));
CREATE POLICY retreats_tenant ON web.retreats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.sites s WHERE s.id = retreats.site_id AND core.has_property_access(s.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.sites s WHERE s.id = retreats.site_id AND core.has_property_access(s.property_id)));
CREATE POLICY series_tenant ON web.series FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.sites s WHERE s.id = series.site_id AND core.has_property_access(s.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.sites s WHERE s.id = series.site_id AND core.has_property_access(s.property_id)));
CREATE POLICY pages_history_tenant ON web.pages_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.pages p JOIN web.sites s ON s.id=p.site_id WHERE p.id = pages_history.page_id AND core.has_property_access(s.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.pages p JOIN web.sites s ON s.id=p.site_id WHERE p.id = pages_history.page_id AND core.has_property_access(s.property_id)));
CREATE POLICY retreats_versions_tenant ON web.retreats_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.retreats r LEFT JOIN web.sites s ON s.id=r.site_id WHERE r.id = retreats_versions.retreat_id AND (s.property_id IS NULL OR core.has_property_access(s.property_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM web.retreats r LEFT JOIN web.sites s ON s.id=r.site_id WHERE r.id = retreats_versions.retreat_id AND (s.property_id IS NULL OR core.has_property_access(s.property_id))));
CREATE POLICY configurations_tenant ON web.configurations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.retreats r LEFT JOIN web.sites s ON s.id=r.site_id WHERE r.id = configurations.retreat_id AND (s.property_id IS NULL OR core.has_property_access(s.property_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM web.retreats r LEFT JOIN web.sites s ON s.id=r.site_id WHERE r.id = configurations.retreat_id AND (s.property_id IS NULL OR core.has_property_access(s.property_id))));
CREATE POLICY ab_tests_tenant ON web.ab_tests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.pages p JOIN web.sites s ON s.id=p.site_id WHERE p.id = ab_tests.page_id AND core.has_property_access(s.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.pages p JOIN web.sites s ON s.id=p.site_id WHERE p.id = ab_tests.page_id AND core.has_property_access(s.property_id)));
