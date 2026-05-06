-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505161620
-- Name:    phase_3_3e_remaining_schemas_tenant
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 3.3e (retry) — Tenant-scope remaining schemas
-- =====================================================================

-- =====================================================================
-- DIRECT property_id PARENTS
-- =====================================================================
DO $$
DECLARE
  parents text[][] := ARRAY[
    ARRAY['catalog','activities'], ARRAY['catalog','addons'], ARRAY['catalog','ceremonies'],
    ARRAY['catalog','fnb_items'], ARRAY['catalog','fnb_menus'], ARRAY['catalog','spa_treatments'],
    ARRAY['catalog','transport_options'], ARRAY['catalog','vendors'], ARRAY['catalog','workshops'],
    ARRAY['compiler','variants'],
    ARRAY['content','legal_pages'], ARRAY['content','series'],
    ARRAY['dq','rules'], ARRAY['dq','run_log'], ARRAY['dq','violations'],
    ARRAY['guest','review_replies'], ARRAY['guest','review_themes'],
    ARRAY['knowledge','qa_findings'],
    ARRAY['kpi','freshness_log'],
    ARRAY['ops','connector_health'], ARRAY['ops','skills'], ARRAY['ops','staff_availability'],
    ARRAY['ops','timeclock'], ARRAY['ops','webhook_events'],
    ARRAY['plan','account_map'], ARRAY['plan','drivers'],
    ARRAY['pricing','fx_locks'], ARRAY['pricing','margin_overrides'],
    ARRAY['seo','core_web_vitals'], ARRAY['seo','indexing_status'],
    ARRAY['seo','pages_daily'], ARRAY['seo','queries_daily'],
    ARRAY['suppliers','suppliers'],
    ARRAY['training','attendance'], ARRAY['training','competencies'],
    ARRAY['alerts','channels'], ARRAY['alerts','sent'],
    ARRAY['news','cached_flights'], ARRAY['news','cached_items']
  ];
  i int; s text; t text;
BEGIN
  FOR i IN 1..array_length(parents, 1) LOOP
    s := parents[i][1]; t := parents[i][2];
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS property_id BIGINT', s, t);
    EXECUTE format('UPDATE %I.%I SET property_id = 260955 WHERE property_id IS NULL', s, t);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN property_id SET NOT NULL', s, t);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
                   s, t, t || '_property_id_fk');
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (property_id) REFERENCES core.properties(property_id)',
                   s, t, t || '_property_id_fk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I(property_id)',
                   t || '_property_id_idx', s, t);
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', s, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', t || '_tenant', s, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO authenticated
        USING (core.has_property_access(property_id))
        WITH CHECK (core.has_property_access(property_id))',
      t || '_tenant', s, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', t || '_service', s, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service', s, t
    );
  END LOOP;
END $$;

-- =====================================================================
-- ALREADY-HAVE property_id (now confirmed BIGINT after 3.3f)
-- =====================================================================
DO $$
DECLARE
  rec record;
  pol record;
  tables_with_pid text[][] := ARRAY[
    ARRAY['activities','bookings'], ARRAY['activities','catalog'], ARRAY['activities','equipment'],
    ARRAY['activities','guides'], ARRAY['activities','partners'], ARRAY['activities','schedules'],
    ARRAY['compiler','itinerary_templates'], ARRAY['compiler','runs'],
    ARRAY['fb','outlets'], ARRAY['fb','recipes'], ARRAY['fb','wastage_log'], ARRAY['fb','food_cost_snapshots'],
    ARRAY['guest','journey_events'], ARRAY['guest','loyalty_members'], ARRAY['guest','nps_responses'], ARRAY['guest','recovery_cases'],
    ARRAY['knowledge','brand_voice_corpus'], ARRAY['knowledge','qa_audits'], ARRAY['knowledge','sop_meta'],
    ARRAY['kpi','daily_snapshots'],
    ARRAY['ops','connectors'], ARRAY['ops','departments'], ARRAY['ops','maintenance_tickets'],
    ARRAY['ops','payroll_daily'], ARRAY['ops','payroll_monthly'], ARRAY['ops','plan_runs'],
    ARRAY['ops','preventive_schedule'], ARRAY['ops','shift_templates'], ARRAY['ops','shifts'],
    ARRAY['ops','staff_attendance'], ARRAY['ops','staff_employment'], ARRAY['ops','task_catalog'], ARRAY['ops','task_instances'],
    ARRAY['plan','otb_snapshots'],
    ARRAY['pricing','pricelist'], ARRAY['pricing','seasons'],
    ARRAY['spa','consumables'], ARRAY['spa','therapists'], ARRAY['spa','treatment_bookings'], ARRAY['spa','treatments'],
    ARRAY['training','certifications'], ARRAY['training','modules'], ARRAY['training','sessions']
  ];
  i int; s text; t text;
BEGIN
  FOR i IN 1..array_length(tables_with_pid, 1) LOOP
    s := tables_with_pid[i][1]; t := tables_with_pid[i][2];
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', s, t);

    FOR pol IN EXECUTE format(
      'SELECT policyname FROM pg_policies WHERE schemaname=%L AND tablename=%L',
      s, t
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, s, t);
    END LOOP;

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
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I(property_id)',
                   t || '_property_id_idx', s, t);
  END LOOP;
END $$;

-- =====================================================================
-- TRUE GLOBALS (read by authenticated, write by service_role only)
-- =====================================================================
DO $$
DECLARE
  rec record;
  pol record;
  globals text[][] := ARRAY[
    ARRAY['fb','allergens'],
    ARRAY['fb','menu_item_allergens'],
    ARRAY['content','lunar_events'],
    ARRAY['content','usali_categories']
  ];
  i int; s text; t text;
BEGIN
  FOR i IN 1..array_length(globals, 1) LOOP
    s := globals[i][1]; t := globals[i][2];
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', s, t);

    FOR pol IN EXECUTE format(
      'SELECT policyname FROM pg_policies WHERE schemaname=%L AND tablename=%L', s, t
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, s, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR SELECT TO authenticated USING (true)',
      t || '_global_read', s, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service', s, t
    );
  END LOOP;
END $$;

-- =====================================================================
-- FK-DERIVED CHILDREN
-- =====================================================================

-- catalog.vendor_rate_cards → catalog.vendors
ALTER TABLE catalog.vendor_rate_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_rate_cards_tenant ON catalog.vendor_rate_cards;
CREATE POLICY vendor_rate_cards_tenant ON catalog.vendor_rate_cards FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM catalog.vendors v WHERE v.id = vendor_rate_cards.vendor_id AND core.has_property_access(v.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM catalog.vendors v WHERE v.id = vendor_rate_cards.vendor_id AND core.has_property_access(v.property_id)));
DROP POLICY IF EXISTS vendor_rate_cards_service ON catalog.vendor_rate_cards;
CREATE POLICY vendor_rate_cards_service ON catalog.vendor_rate_cards FOR ALL TO service_role USING (true) WITH CHECK (true);

-- fb.recipe_ingredients → fb.recipes
ALTER TABLE fb.recipe_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recipe_ingredients_tenant ON fb.recipe_ingredients;
CREATE POLICY recipe_ingredients_tenant ON fb.recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM fb.recipes r WHERE r.recipe_id = recipe_ingredients.recipe_id AND core.has_property_access(r.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM fb.recipes r WHERE r.recipe_id = recipe_ingredients.recipe_id AND core.has_property_access(r.property_id)));
DROP POLICY IF EXISTS recipe_ingredients_service ON fb.recipe_ingredients;
CREATE POLICY recipe_ingredients_service ON fb.recipe_ingredients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- spa.therapist_treatments → spa.therapists
ALTER TABLE spa.therapist_treatments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS therapist_treatments_tenant ON spa.therapist_treatments;
CREATE POLICY therapist_treatments_tenant ON spa.therapist_treatments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM spa.therapists th WHERE th.therapist_id = therapist_treatments.therapist_id AND core.has_property_access(th.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM spa.therapists th WHERE th.therapist_id = therapist_treatments.therapist_id AND core.has_property_access(th.property_id)));
DROP POLICY IF EXISTS therapist_treatments_service ON spa.therapist_treatments;
CREATE POLICY therapist_treatments_service ON spa.therapist_treatments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- suppliers children
DO $$
DECLARE
  tbl text;
  supplier_children text[] := ARRAY['contacts','price_history'];
BEGIN
  FOREACH tbl IN ARRAY supplier_children LOOP
    EXECUTE format('ALTER TABLE suppliers.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON suppliers.%I', tbl || '_tenant', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON suppliers.%I FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM suppliers.suppliers s WHERE s.supplier_id = %I.supplier_id AND core.has_property_access(s.property_id)))
        WITH CHECK (EXISTS (SELECT 1 FROM suppliers.suppliers s WHERE s.supplier_id = %I.supplier_id AND core.has_property_access(s.property_id)))',
      tbl || '_tenant', tbl, tbl, tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON suppliers.%I', tbl || '_service', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON suppliers.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;

ALTER TABLE suppliers.alternates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alternates_tenant ON suppliers.alternates;
CREATE POLICY alternates_tenant ON suppliers.alternates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM suppliers.suppliers s WHERE s.supplier_id = alternates.primary_supplier_id AND core.has_property_access(s.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM suppliers.suppliers s WHERE s.supplier_id = alternates.primary_supplier_id AND core.has_property_access(s.property_id)));
DROP POLICY IF EXISTS alternates_service ON suppliers.alternates;
CREATE POLICY alternates_service ON suppliers.alternates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- web.campaigns, web.subscribers — direct property_id (final batch)
DO $$
DECLARE
  rec record;
  pol record;
  parents text[][] := ARRAY[
    ARRAY['web','campaigns'],
    ARRAY['web','subscribers']
  ];
  i int; s text; t text;
BEGIN
  FOR i IN 1..array_length(parents, 1) LOOP
    s := parents[i][1]; t := parents[i][2];
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS property_id BIGINT', s, t);
    EXECUTE format('UPDATE %I.%I SET property_id = 260955 WHERE property_id IS NULL', s, t);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN property_id SET NOT NULL', s, t);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
                   s, t, t || '_property_id_fk');
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (property_id) REFERENCES core.properties(property_id)',
                   s, t, t || '_property_id_fk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I(property_id)',
                   t || '_property_id_idx', s, t);
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', s, t);

    FOR pol IN EXECUTE format(
      'SELECT policyname FROM pg_policies WHERE schemaname=%L AND tablename=%L', s, t
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, s, t);
    END LOOP;

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
  END LOOP;
END $$;

-- web.campaign_pages → web.campaigns
ALTER TABLE web.campaign_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_pages_tenant ON web.campaign_pages;
CREATE POLICY campaign_pages_tenant ON web.campaign_pages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.campaigns c WHERE c.id = campaign_pages.campaign_id AND core.has_property_access(c.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.campaigns c WHERE c.id = campaign_pages.campaign_id AND core.has_property_access(c.property_id)));
DROP POLICY IF EXISTS campaign_pages_service ON web.campaign_pages;
CREATE POLICY campaign_pages_service ON web.campaign_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- web.consents → web.subscribers
ALTER TABLE web.consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consents_tenant ON web.consents;
CREATE POLICY consents_tenant ON web.consents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.subscribers sub WHERE sub.id = consents.subscriber_id AND core.has_property_access(sub.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.subscribers sub WHERE sub.id = consents.subscriber_id AND core.has_property_access(sub.property_id)));
DROP POLICY IF EXISTS consents_service ON web.consents;
CREATE POLICY consents_service ON web.consents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- web.email_sends → web.subscribers
ALTER TABLE web.email_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_sends_tenant ON web.email_sends;
CREATE POLICY email_sends_tenant ON web.email_sends FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM web.subscribers sub WHERE sub.id = email_sends.subscriber_id AND core.has_property_access(sub.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM web.subscribers sub WHERE sub.id = email_sends.subscriber_id AND core.has_property_access(sub.property_id)));
DROP POLICY IF EXISTS email_sends_service ON web.email_sends;
CREATE POLICY email_sends_service ON web.email_sends FOR ALL TO service_role USING (true) WITH CHECK (true);

-- web.events: subscriber_id OR campaign_id OR page_id
ALTER TABLE web.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_tenant ON web.events;
CREATE POLICY events_tenant ON web.events FOR ALL TO authenticated
  USING (
    (subscriber_id IS NOT NULL AND EXISTS (SELECT 1 FROM web.subscribers sub WHERE sub.id = events.subscriber_id AND core.has_property_access(sub.property_id)))
    OR
    (campaign_id IS NOT NULL AND EXISTS (SELECT 1 FROM web.campaigns c WHERE c.id = events.campaign_id AND core.has_property_access(c.property_id)))
    OR
    (page_id IS NOT NULL AND EXISTS (SELECT 1 FROM web.pages p JOIN web.sites s ON s.id=p.site_id WHERE p.id = events.page_id AND core.has_property_access(s.property_id)))
  )
  WITH CHECK (
    (subscriber_id IS NOT NULL AND EXISTS (SELECT 1 FROM web.subscribers sub WHERE sub.id = events.subscriber_id AND core.has_property_access(sub.property_id)))
    OR
    (campaign_id IS NOT NULL AND EXISTS (SELECT 1 FROM web.campaigns c WHERE c.id = events.campaign_id AND core.has_property_access(c.property_id)))
    OR
    (page_id IS NOT NULL AND EXISTS (SELECT 1 FROM web.pages p JOIN web.sites s ON s.id=p.site_id WHERE p.id = events.page_id AND core.has_property_access(s.property_id)))
  );
DROP POLICY IF EXISTS events_service ON web.events;
CREATE POLICY events_service ON web.events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- training.attendance → training.sessions
ALTER TABLE training.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_tenant ON training.attendance;
CREATE POLICY attendance_tenant ON training.attendance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM training.sessions sess WHERE sess.session_id = attendance.session_id AND core.has_property_access(sess.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM training.sessions sess WHERE sess.session_id = attendance.session_id AND core.has_property_access(sess.property_id)));
DROP POLICY IF EXISTS attendance_service ON training.attendance;
CREATE POLICY attendance_service ON training.attendance FOR ALL TO service_role USING (true) WITH CHECK (true);
