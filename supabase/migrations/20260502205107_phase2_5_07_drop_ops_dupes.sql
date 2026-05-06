-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502205107
-- Name:    phase2_5_07_drop_ops_dupes
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Phase 2.5 — drop empty ops.* duplicates that conflict with fa.* / suppliers.* / proc.*
-- Pre-checked: all target tables empty. Dependents either empty (CASCADE OK) or non-using
-- (ops.task_catalog has 26 rows but ZERO use asset_id, so dropping ops.assets just drops
-- the FK constraint — column stays orphaned, can be cleaned in a later migration).

-- Drop the dependent ops PO line table first (empty)
DROP TABLE IF EXISTS ops.purchase_order_lines CASCADE;
DROP TABLE IF EXISTS ops.purchase_orders     CASCADE;

-- ops.assets — CASCADE to drop FK from task_catalog/maintenance_tickets/preventive_schedule/equipment
DROP TABLE IF EXISTS ops.assets              CASCADE;

-- ops.vendor_benchmarks references ops.vendors — drop first if exists
DROP TABLE IF EXISTS ops.vendor_benchmarks   CASCADE;
DROP VIEW  IF EXISTS ops.v_vendor_cost_drift CASCADE;

-- Now ops.vendors — CASCADE to clear FKs in activities.partners / fb.recipe_ingredients / spa.consumables
DROP TABLE IF EXISTS ops.vendors             CASCADE;

-- The orphaned vendor_id columns on activities.partners, fb.recipe_ingredients, spa.consumables
-- are now FK-less. Repoint them to suppliers.suppliers so future inserts validate.
-- Only do this if the column type is uuid (it is, since ops.vendors.vendor_id was uuid).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, c.relname AS tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE (n.nspname,c.relname) IN
          (('activities','partners'),('fb','recipe_ingredients'),('spa','consumables'))
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='vendor_id' AND NOT a.attisdropped)
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (vendor_id) REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL',
      r.schema, r.tbl, r.tbl || '_vendor_id_fkey_suppliers'
    );
  END LOOP;
END $$;
