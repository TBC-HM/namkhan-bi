-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505160740
-- Name:    phase_3_3a_gl_schema_tenant
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 3.3a — Add property_id + tenant RLS to gl.* schema
-- Skipped: gl.fx_rates, gl.vat_rates (true global lookups)
-- Already done: gl.cash_forecast_weekly, gl.materiality_thresholds (have property_id)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper macro: for each tenant table, add property_id, FK, index, RLS
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables_to_process text[] := ARRAY[
    'account_class_override',
    'accounts',
    'accounts_legacy',
    'budgets',
    'classes',
    'commentary_drafts',
    'dq_findings',
    'dq_findings_log',
    'gl_entries',
    'manual_entries',
    'pl_monthly',
    'pl_section_monthly',
    'pl_summary_monthly',
    'pnl_snapshot',
    'qb_import_staging',
    'transactions',
    'uploads',
    'usali_expense_map',
    'vendors'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_process LOOP
    -- Add column if missing
    EXECUTE format('ALTER TABLE gl.%I ADD COLUMN IF NOT EXISTS property_id BIGINT', tbl);
    -- Backfill to Namkhan
    EXECUTE format('UPDATE gl.%I SET property_id = 260955 WHERE property_id IS NULL', tbl);
    -- Make NOT NULL
    EXECUTE format('ALTER TABLE gl.%I ALTER COLUMN property_id SET NOT NULL', tbl);
    -- FK to core.properties (drop first if pre-existing constraint with same name)
    EXECUTE format('ALTER TABLE gl.%I DROP CONSTRAINT IF EXISTS %I',
                   tbl, tbl || '_property_id_fk');
    EXECUTE format('ALTER TABLE gl.%I ADD CONSTRAINT %I FOREIGN KEY (property_id) REFERENCES core.properties(property_id)',
                   tbl, tbl || '_property_id_fk');
    -- Index
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON gl.%I(property_id)',
                   tbl || '_property_id_idx', tbl);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Enable RLS on tables that didn't have it; drop old USING(true)-style policies
-- on tables that did, replace with tenant policy.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  pol record;
  tables_all text[] := ARRAY[
    'account_class_override','accounts','accounts_legacy','budgets','classes',
    'commentary_drafts','dq_findings','dq_findings_log','gl_entries','manual_entries',
    'pl_monthly','pl_section_monthly','pl_summary_monthly','pnl_snapshot',
    'qb_import_staging','transactions','uploads','usali_expense_map','vendors',
    'cash_forecast_weekly','materiality_thresholds'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_all LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE gl.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop ALL existing policies (clean slate) so the new tenant + service policies are authoritative
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname='gl' AND tablename=tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON gl.%I', pol.policyname, tbl);
    END LOOP;

    -- Tenant policy for authenticated
    EXECUTE format(
      'CREATE POLICY %I ON gl.%I FOR ALL TO authenticated
        USING (core.has_property_access(property_id))
        WITH CHECK (core.has_property_access(property_id))',
      tbl || '_tenant', tbl
    );

    -- Service role full access
    EXECUTE format(
      'CREATE POLICY %I ON gl.%I FOR ALL TO service_role
        USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;
