-- ============================================================================
-- Migration: 07_drop_ops_dupes  (Phase 2.5 cleanup)
-- Version:   20260502230016
-- Date:      2026-05-02
-- ----------------------------------------------------------------------------
-- Drop empty ops.* duplicates of fa / suppliers / proc tables.
-- Pre-checked: all target tables empty.
-- Dependents on ops.assets:
--   activities.equipment, ops.maintenance_tickets, ops.preventive_schedule (all 0 rows)
--   ops.task_catalog (26 rows but ZERO use asset_id)
-- Dependents on ops.vendors:
--   activities.partners, fb.recipe_ingredients, spa.consumables (all 0 rows)
--   ops.purchase_orders, ops.vendor_benchmarks (also being dropped)
-- After CASCADE, vendor_id columns survive on activities.partners /
-- fb.recipe_ingredients / spa.consumables — we re-FK them to suppliers.suppliers.
-- ============================================================================

DROP TABLE IF EXISTS ops.purchase_order_lines CASCADE;
DROP TABLE IF EXISTS ops.purchase_orders      CASCADE;
DROP TABLE IF EXISTS ops.assets               CASCADE;
DROP TABLE IF EXISTS ops.vendor_benchmarks    CASCADE;
DROP VIEW  IF EXISTS ops.v_vendor_cost_drift  CASCADE;
DROP TABLE IF EXISTS ops.vendors              CASCADE;

-- Repoint orphaned vendor_id columns to suppliers.suppliers.
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
