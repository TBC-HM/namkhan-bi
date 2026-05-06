-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505161106
-- Name:    phase_3_3d_book_pos_fo_gov_tenant
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 3.3d — Tenant-scope book.*, pos.*, frontoffice.*, governance.*
-- =====================================================================

-- =====================================================================
-- DIRECT property_id ON PARENTS
-- =====================================================================
DO $$
DECLARE
  rec record;
  parents text[][] := ARRAY[
    ARRAY['book','bookings'],
    ARRAY['pos','poster_receipts'],
    ARRAY['pos','poster_room_type_alias'],
    ARRAY['pos','poster_uploads'],
    ARRAY['frontoffice','agent_runs'],
    ARRAY['frontoffice','brand_voice'],
    ARRAY['frontoffice','group_arrival_plans'],
    ARRAY['governance','dmc_contracts'],
    ARRAY['governance','decision_queue'],
    ARRAY['governance','tools_catalog'],
    ARRAY['governance','agent_prompts'],
    ARRAY['governance','agent_secrets'],
    ARRAY['governance','agent_triggers'],
    ARRAY['governance','agent_budgets'],
    ARRAY['governance','mandate_rules'],
    ARRAY['governance','proposal_decisions'],
    ARRAY['governance','proposal_outcomes']
  ];
  i int;
  s text; t text;
BEGIN
  FOR i IN 1..array_length(parents, 1) LOOP
    s := parents[i][1]; t := parents[i][2];
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS property_id BIGINT', s, t);
    EXECUTE format('UPDATE %I.%I SET property_id = 260955 WHERE property_id IS NULL', s, t);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN property_id SET NOT NULL', s, t);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', s, t, t || '_property_id_fk');
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (property_id) REFERENCES core.properties(property_id)',
                   s, t, t || '_property_id_fk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I(property_id)', t || '_property_id_idx', s, t);
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
-- governance.* tables that already had property_id — add tenant policy if missing
-- =====================================================================
DO $$
DECLARE
  tbl text;
  pol record;
  already_have_pid text[] := ARRAY['agents','agent_runs','authority_limits','mandate_breaches','mandates','proposals'];
BEGIN
  FOREACH tbl IN ARRAY already_have_pid LOOP
    EXECUTE format('ALTER TABLE governance.%I ENABLE ROW LEVEL SECURITY', tbl);
    -- Wipe existing policies for clean slate
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='governance' AND tablename=tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON governance.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON governance.%I FOR ALL TO authenticated
        USING (core.has_property_access(property_id))
        WITH CHECK (core.has_property_access(property_id))',
      tbl || '_tenant', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON governance.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON governance.%I(property_id)',
                   tbl || '_property_id_idx', tbl);
  END LOOP;
END $$;

-- =====================================================================
-- book.* CHILDREN (cancel/payments/reconcile_alerts) via booking_id
-- =====================================================================
DO $$
DECLARE
  tbl text;
  book_children text[] := ARRAY['cancellations','payments','reconcile_alerts'];
BEGIN
  FOREACH tbl IN ARRAY book_children LOOP
    EXECUTE format('ALTER TABLE book.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON book.%I', tbl || '_tenant', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON book.%I FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM book.bookings b
          WHERE b.id = %I.booking_id
            AND core.has_property_access(b.property_id)
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM book.bookings b
          WHERE b.id = %I.booking_id
            AND core.has_property_access(b.property_id)
        ))',
      tbl || '_tenant', tbl, tbl, tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON book.%I', tbl || '_service', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON book.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;

-- =====================================================================
-- frontoffice.* CHILDREN (prearrival_messages, upsell_offers, vip_briefs,
-- eta_tracking, compliance_docs) via arrival_id -> arrivals.property_id
-- =====================================================================
DO $$
DECLARE
  tbl text;
  fo_children text[] := ARRAY['prearrival_messages','upsell_offers','vip_briefs','eta_tracking','compliance_docs'];
BEGIN
  FOREACH tbl IN ARRAY fo_children LOOP
    EXECUTE format('ALTER TABLE frontoffice.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON frontoffice.%I', tbl || '_tenant', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON frontoffice.%I FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM frontoffice.arrivals a
          WHERE a.id = %I.arrival_id
            AND core.has_property_access(a.property_id)
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM frontoffice.arrivals a
          WHERE a.id = %I.arrival_id
            AND core.has_property_access(a.property_id)
        ))',
      tbl || '_tenant', tbl, tbl, tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON frontoffice.%I', tbl || '_service', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON frontoffice.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;

-- frontoffice.arrivals already had property_id; just ensure RLS + tenant policy
DO $$
DECLARE pol record;
BEGIN
  ALTER TABLE frontoffice.arrivals ENABLE ROW LEVEL SECURITY;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='frontoffice' AND tablename='arrivals' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON frontoffice.arrivals', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY arrivals_tenant ON frontoffice.arrivals
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY arrivals_service ON frontoffice.arrivals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS arrivals_property_id_idx ON frontoffice.arrivals(property_id);

-- =====================================================================
-- governance.mandate_rules — child of mandates
-- =====================================================================
ALTER TABLE governance.mandate_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mandate_rules_tenant_v2 ON governance.mandate_rules;
DROP POLICY IF EXISTS mandate_rules_tenant ON governance.mandate_rules;
CREATE POLICY mandate_rules_tenant ON governance.mandate_rules
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM governance.mandates m
    WHERE m.mandate_id = mandate_rules.mandate_id
      AND core.has_property_access(m.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM governance.mandates m
    WHERE m.mandate_id = mandate_rules.mandate_id
      AND core.has_property_access(m.property_id)
  ));
DROP POLICY IF EXISTS mandate_rules_service ON governance.mandate_rules;
CREATE POLICY mandate_rules_service ON governance.mandate_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- governance.proposal_decisions, proposal_outcomes — children of proposals
-- (these already got direct property_id above; switch to FK-derived for consistency)
-- =====================================================================
-- Already handled by direct property_id block above. They're independent records.
