-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505161005
-- Name:    phase_3_3c_fa_inv_proc_tenant
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 3.3c — Tenant-scope fa.*, inv.*, proc.*
-- Skipped: inv.units (true global UOMs)
-- =====================================================================

-- ---------------------------------------------------------------------
-- DIRECT property_id (parents and standalone tables)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  rec record;
  parents text[][] := ARRAY[
    -- schema, table
    ARRAY['fa','assets'],
    ARRAY['fa','categories'],
    ARRAY['fa','capex_pipeline'],
    ARRAY['inv','categories'],
    ARRAY['inv','locations'],
    ARRAY['inv','items'],
    ARRAY['proc','requests'],
    ARRAY['proc','purchase_orders'],
    ARRAY['proc','config'],
    ARRAY['proc','new_item_proposals']
  ];
  i int;
  schema_name text;
  table_name text;
BEGIN
  FOR i IN 1..array_length(parents, 1) LOOP
    schema_name := parents[i][1];
    table_name  := parents[i][2];
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS property_id BIGINT', schema_name, table_name);
    EXECUTE format('UPDATE %I.%I SET property_id = 260955 WHERE property_id IS NULL', schema_name, table_name);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN property_id SET NOT NULL', schema_name, table_name);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
                   schema_name, table_name, table_name || '_property_id_fk');
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (property_id) REFERENCES core.properties(property_id)',
                   schema_name, table_name, table_name || '_property_id_fk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I(property_id)',
                   table_name || '_property_id_idx', schema_name, table_name);
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', schema_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', table_name || '_tenant', schema_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO authenticated
        USING (core.has_property_access(property_id))
        WITH CHECK (core.has_property_access(property_id))',
      table_name || '_tenant', schema_name, table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', table_name || '_service', schema_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO service_role
        USING (true) WITH CHECK (true)',
      table_name || '_service', schema_name, table_name
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- inv.units stays global (UOMs are universal)
-- ---------------------------------------------------------------------
ALTER TABLE inv.units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS units_global_read ON inv.units;
CREATE POLICY units_global_read ON inv.units
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS units_service ON inv.units;
CREATE POLICY units_service ON inv.units
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- fa CHILDREN deriving from fa.assets via asset_id
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  fa_children text[] := ARRAY['asset_movements','maintenance_log','documents'];
BEGIN
  FOREACH tbl IN ARRAY fa_children LOOP
    EXECUTE format('ALTER TABLE fa.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON fa.%I', tbl || '_tenant', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON fa.%I FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM fa.assets a
          WHERE a.asset_id = %I.asset_id
            AND core.has_property_access(a.property_id)
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM fa.assets a
          WHERE a.asset_id = %I.asset_id
            AND core.has_property_access(a.property_id)
        ))',
      tbl || '_tenant', tbl, tbl, tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON fa.%I', tbl || '_service', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON fa.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- inv CHILDREN
-- par_levels, stock_balance: via item_id -> inv.items
-- movements: via item_id (could also use location_id; item is canonical)
-- counts: via location_id
-- count_lines: via count_id -> counts -> location
-- photos: via item_id -> items
-- ---------------------------------------------------------------------

-- par_levels (item_id-based)
ALTER TABLE inv.par_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS par_levels_tenant ON inv.par_levels;
CREATE POLICY par_levels_tenant ON inv.par_levels FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = par_levels.item_id AND core.has_property_access(i.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = par_levels.item_id AND core.has_property_access(i.property_id)));
DROP POLICY IF EXISTS par_levels_service ON inv.par_levels;
CREATE POLICY par_levels_service ON inv.par_levels FOR ALL TO service_role USING (true) WITH CHECK (true);

-- stock_balance (item_id-based)
ALTER TABLE inv.stock_balance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_balance_tenant ON inv.stock_balance;
CREATE POLICY stock_balance_tenant ON inv.stock_balance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = stock_balance.item_id AND core.has_property_access(i.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = stock_balance.item_id AND core.has_property_access(i.property_id)));
DROP POLICY IF EXISTS stock_balance_service ON inv.stock_balance;
CREATE POLICY stock_balance_service ON inv.stock_balance FOR ALL TO service_role USING (true) WITH CHECK (true);

-- movements (item_id-based)
ALTER TABLE inv.movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS movements_tenant ON inv.movements;
CREATE POLICY movements_tenant ON inv.movements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = movements.item_id AND core.has_property_access(i.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = movements.item_id AND core.has_property_access(i.property_id)));
DROP POLICY IF EXISTS movements_service ON inv.movements;
CREATE POLICY movements_service ON inv.movements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- counts (location_id-based)
ALTER TABLE inv.counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS counts_tenant ON inv.counts;
CREATE POLICY counts_tenant ON inv.counts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM inv.locations l WHERE l.location_id = counts.location_id AND core.has_property_access(l.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM inv.locations l WHERE l.location_id = counts.location_id AND core.has_property_access(l.property_id)));
DROP POLICY IF EXISTS counts_service ON inv.counts;
CREATE POLICY counts_service ON inv.counts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- count_lines (item_id-based; simpler than chasing through counts)
ALTER TABLE inv.count_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS count_lines_tenant ON inv.count_lines;
CREATE POLICY count_lines_tenant ON inv.count_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = count_lines.item_id AND core.has_property_access(i.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = count_lines.item_id AND core.has_property_access(i.property_id)));
DROP POLICY IF EXISTS count_lines_service ON inv.count_lines;
CREATE POLICY count_lines_service ON inv.count_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- photos (item_id-based)
ALTER TABLE inv.photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photos_tenant ON inv.photos;
CREATE POLICY photos_tenant ON inv.photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = photos.item_id AND core.has_property_access(i.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM inv.items i WHERE i.item_id = photos.item_id AND core.has_property_access(i.property_id)));
DROP POLICY IF EXISTS photos_service ON inv.photos;
CREATE POLICY photos_service ON inv.photos FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- proc CHILDREN
-- request_items: via pr_id -> requests
-- po_items: via po_id -> purchase_orders
-- receipts: via po_id -> purchase_orders
-- approval_log: via pr_id OR po_id (either)
-- ---------------------------------------------------------------------

-- request_items
ALTER TABLE proc.request_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_items_tenant ON proc.request_items;
CREATE POLICY request_items_tenant ON proc.request_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM proc.requests r WHERE r.pr_id = request_items.pr_id AND core.has_property_access(r.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM proc.requests r WHERE r.pr_id = request_items.pr_id AND core.has_property_access(r.property_id)));
DROP POLICY IF EXISTS request_items_service ON proc.request_items;
CREATE POLICY request_items_service ON proc.request_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- po_items
ALTER TABLE proc.po_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS po_items_tenant ON proc.po_items;
CREATE POLICY po_items_tenant ON proc.po_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM proc.purchase_orders po WHERE po.po_id = po_items.po_id AND core.has_property_access(po.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM proc.purchase_orders po WHERE po.po_id = po_items.po_id AND core.has_property_access(po.property_id)));
DROP POLICY IF EXISTS po_items_service ON proc.po_items;
CREATE POLICY po_items_service ON proc.po_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- receipts
ALTER TABLE proc.receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipts_tenant ON proc.receipts;
CREATE POLICY receipts_tenant ON proc.receipts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM proc.purchase_orders po WHERE po.po_id = receipts.po_id AND core.has_property_access(po.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM proc.purchase_orders po WHERE po.po_id = receipts.po_id AND core.has_property_access(po.property_id)));
DROP POLICY IF EXISTS receipts_service ON proc.receipts;
CREATE POLICY receipts_service ON proc.receipts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- approval_log: pr_id OR po_id derivation
ALTER TABLE proc.approval_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS approval_log_tenant ON proc.approval_log;
CREATE POLICY approval_log_tenant ON proc.approval_log FOR ALL TO authenticated
  USING (
    (pr_id IS NOT NULL AND EXISTS (SELECT 1 FROM proc.requests r WHERE r.pr_id = approval_log.pr_id AND core.has_property_access(r.property_id)))
    OR
    (po_id IS NOT NULL AND EXISTS (SELECT 1 FROM proc.purchase_orders po WHERE po.po_id = approval_log.po_id AND core.has_property_access(po.property_id)))
  )
  WITH CHECK (
    (pr_id IS NOT NULL AND EXISTS (SELECT 1 FROM proc.requests r WHERE r.pr_id = approval_log.pr_id AND core.has_property_access(r.property_id)))
    OR
    (po_id IS NOT NULL AND EXISTS (SELECT 1 FROM proc.purchase_orders po WHERE po.po_id = approval_log.po_id AND core.has_property_access(po.property_id)))
  );
DROP POLICY IF EXISTS approval_log_service ON proc.approval_log;
CREATE POLICY approval_log_service ON proc.approval_log FOR ALL TO service_role USING (true) WITH CHECK (true);
