-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502195323
-- Name:    phase2_5_03_inv_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Phase 2.5 — 03_inv_schema
CREATE SCHEMA IF NOT EXISTS inv;
COMMENT ON SCHEMA inv IS 'Consumables - par stock, movements, counts, batches, photos.';

CREATE TABLE IF NOT EXISTS inv.categories (
  category_id          BIGSERIAL PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  description          TEXT,
  usali_dept           TEXT,
  default_shelf_life_days INT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inv.units (
  unit_id              BIGSERIAL PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  unit_class           TEXT NOT NULL CHECK (unit_class IN ('weight','volume','count','length','area','other')),
  base_unit_id         BIGINT REFERENCES inv.units(unit_id),
  conversion_factor    NUMERIC(14,6) DEFAULT 1.0,
  is_active            BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS inv.locations (
  location_id          BIGSERIAL PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  location_name        TEXT NOT NULL,
  area_type            TEXT NOT NULL CHECK (area_type IN ('main_storage','kitchen','fb_outlet','hk_storage','spa_storage','retail','plant_room','office','exterior','other')),
  parent_location_id   BIGINT REFERENCES inv.locations(location_id) ON DELETE SET NULL,
  room_id              BIGINT,
  responsible_dept     TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_locations_dept ON inv.locations(responsible_dept) WHERE responsible_dept IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_locations_area ON inv.locations(area_type);

CREATE TABLE IF NOT EXISTS inv.items (
  item_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                  TEXT NOT NULL UNIQUE,
  item_name            TEXT NOT NULL,
  description          TEXT,
  category_id          BIGINT NOT NULL REFERENCES inv.categories(category_id) ON DELETE RESTRICT,
  uom_id               BIGINT NOT NULL REFERENCES inv.units(unit_id) ON DELETE RESTRICT,
  default_location_id  BIGINT REFERENCES inv.locations(location_id) ON DELETE SET NULL,
  primary_vendor_id    UUID REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL,
  alternate_vendor_id  UUID REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL,
  last_unit_cost_lak   NUMERIC(14,2),
  last_unit_cost_usd   NUMERIC(12,2),
  fx_rate_used         NUMERIC(14,4),
  reorder_point        NUMERIC(12,3),
  reorder_quantity     NUMERIC(12,3),
  shelf_life_days      INT,
  is_perishable        BOOLEAN NOT NULL DEFAULT false,
  storage_temp         TEXT CHECK (storage_temp IN ('ambient','chilled','frozen','dry','climate_controlled')),
  gl_account_code      TEXT,
  catalog_status       TEXT NOT NULL DEFAULT 'approved' CHECK (catalog_status IN ('approved','pending_review','deprecated','rejected')),
  catalog_approved_by  UUID,
  catalog_approved_at  TIMESTAMPTZ,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID DEFAULT auth.uid(),
  updated_by           UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_inv_items_category   ON inv.items(category_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_active     ON inv.items(is_active);
CREATE INDEX IF NOT EXISTS idx_inv_items_status     ON inv.items(catalog_status);
CREATE INDEX IF NOT EXISTS idx_inv_items_vendor     ON inv.items(primary_vendor_id) WHERE primary_vendor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inv.par_levels (
  par_id               BIGSERIAL PRIMARY KEY,
  item_id              UUID NOT NULL REFERENCES inv.items(item_id) ON DELETE CASCADE,
  location_id          BIGINT NOT NULL REFERENCES inv.locations(location_id) ON DELETE CASCADE,
  par_quantity         NUMERIC(12,3) NOT NULL CHECK (par_quantity >= 0),
  min_quantity         NUMERIC(12,3),
  max_quantity         NUMERIC(12,3),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_par_location ON inv.par_levels(location_id);

CREATE TABLE IF NOT EXISTS inv.stock_balance (
  balance_id           BIGSERIAL PRIMARY KEY,
  item_id              UUID NOT NULL REFERENCES inv.items(item_id) ON DELETE CASCADE,
  location_id          BIGINT NOT NULL REFERENCES inv.locations(location_id) ON DELETE CASCADE,
  quantity_on_hand     NUMERIC(12,3) NOT NULL DEFAULT 0,
  last_movement_at     TIMESTAMPTZ,
  last_count_at        TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_balance_location ON inv.stock_balance(location_id);

CREATE TABLE IF NOT EXISTS inv.movements (
  movement_id          BIGSERIAL PRIMARY KEY,
  item_id              UUID NOT NULL REFERENCES inv.items(item_id) ON DELETE RESTRICT,
  location_id          BIGINT NOT NULL REFERENCES inv.locations(location_id) ON DELETE RESTRICT,
  movement_type        TEXT NOT NULL CHECK (movement_type IN ('receive','issue','consume','transfer_in','transfer_out','count_correction','write_off','waste','open_stock')),
  quantity             NUMERIC(12,3) NOT NULL,
  unit_cost_lak        NUMERIC(12,2),
  unit_cost_usd        NUMERIC(10,2),
  fx_rate_used         NUMERIC(14,4),
  total_cost_lak       NUMERIC(14,2),
  total_cost_usd       NUMERIC(12,2),
  vendor_id            UUID REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL,
  counterparty_location_id BIGINT REFERENCES inv.locations(location_id) ON DELETE SET NULL,
  reference_type       TEXT,
  reference_id         TEXT,
  batch_code           TEXT,
  expiry_date          DATE,
  movement_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  moved_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  moved_by             UUID DEFAULT auth.uid(),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((movement_type IN ('transfer_in','transfer_out')) = (counterparty_location_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_inv_mov_item     ON inv.movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_location ON inv.movements(location_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_date     ON inv.movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type     ON inv.movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_vendor   ON inv.movements(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_mov_expiry   ON inv.movements(expiry_date) WHERE expiry_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS inv.counts (
  count_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_date           DATE NOT NULL,
  location_id          BIGINT NOT NULL REFERENCES inv.locations(location_id) ON DELETE RESTRICT,
  count_type           TEXT NOT NULL DEFAULT 'periodic' CHECK (count_type IN ('periodic','spot','cycle','annual','opening')),
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','adjusted','rejected')),
  counted_by           UUID DEFAULT auth.uid(),
  approved_by          UUID,
  approved_at          TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_counts_date     ON inv.counts(count_date);
CREATE INDEX IF NOT EXISTS idx_inv_counts_location ON inv.counts(location_id);
CREATE INDEX IF NOT EXISTS idx_inv_counts_status   ON inv.counts(status);

CREATE TABLE IF NOT EXISTS inv.count_lines (
  count_line_id        BIGSERIAL PRIMARY KEY,
  count_id             UUID NOT NULL REFERENCES inv.counts(count_id) ON DELETE CASCADE,
  item_id              UUID NOT NULL REFERENCES inv.items(item_id) ON DELETE RESTRICT,
  counted_quantity     NUMERIC(12,3) NOT NULL,
  system_quantity      NUMERIC(12,3),
  variance             NUMERIC(12,3) GENERATED ALWAYS AS (counted_quantity - COALESCE(system_quantity,0)) STORED,
  unit_cost_usd        NUMERIC(10,2),
  variance_value_usd   NUMERIC(12,2) GENERATED ALWAYS AS ((counted_quantity - COALESCE(system_quantity,0)) * COALESCE(unit_cost_usd,0)) STORED,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (count_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_count_lines_item ON inv.count_lines(item_id);

CREATE TABLE IF NOT EXISTS inv.photos (
  photo_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id              UUID NOT NULL REFERENCES inv.items(item_id) ON DELETE CASCADE,
  storage_path         TEXT NOT NULL,
  filename             TEXT NOT NULL,
  is_primary           BOOLEAN NOT NULL DEFAULT false,
  display_order        INT NOT NULL DEFAULT 0,
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by          UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_inv_photos_item    ON inv.photos(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_photos_primary ON inv.photos(item_id) WHERE is_primary = true;

CREATE OR REPLACE VIEW inv.v_inv_stock_on_hand AS
SELECT i.item_id, i.sku, i.item_name, i.category_id, c.name AS category_name,
  SUM(COALESCE(b.quantity_on_hand,0))                                    AS total_on_hand,
  SUM(COALESCE(b.quantity_on_hand,0) * COALESCE(i.last_unit_cost_usd,0)) AS value_usd_estimate,
  count(DISTINCT b.location_id) FILTER (WHERE b.quantity_on_hand > 0)    AS locations_with_stock,
  MAX(b.last_movement_at)                                                AS last_movement_at,
  MAX(b.last_count_at)                                                   AS last_count_at
FROM inv.items i
LEFT JOIN inv.stock_balance b ON b.item_id = i.item_id
JOIN inv.categories c USING (category_id)
WHERE i.is_active
GROUP BY i.item_id, i.sku, i.item_name, i.category_id, c.name;

CREATE OR REPLACE VIEW inv.v_inv_par_status AS
SELECT p.item_id, i.sku, i.item_name, p.location_id, l.location_name, p.par_quantity,
  COALESCE(p.min_quantity, p.par_quantity * 0.5) AS effective_min,
  COALESCE(p.max_quantity, p.par_quantity * 1.5) AS effective_max,
  COALESCE(b.quantity_on_hand,0) AS on_hand,
  CASE
    WHEN COALESCE(b.quantity_on_hand,0) <= 0                                              THEN 'stock_out'
    WHEN COALESCE(b.quantity_on_hand,0) <  COALESCE(p.min_quantity, p.par_quantity * 0.5) THEN 'reorder_now'
    WHEN COALESCE(b.quantity_on_hand,0) <  p.par_quantity                                 THEN 'below_par'
    WHEN COALESCE(b.quantity_on_hand,0) >  COALESCE(p.max_quantity, p.par_quantity * 1.5) THEN 'overstocked'
    ELSE 'ok'
  END AS par_status,
  ROUND(100.0 * COALESCE(b.quantity_on_hand,0) / NULLIF(p.par_quantity,0), 1) AS pct_of_par,
  GREATEST(0, p.par_quantity - COALESCE(b.quantity_on_hand, 0)) AS short_quantity,
  i.last_unit_cost_usd,
  GREATEST(0, p.par_quantity - COALESCE(b.quantity_on_hand, 0)) * COALESCE(i.last_unit_cost_usd, 0) AS reorder_value_usd,
  i.primary_vendor_id
FROM inv.par_levels p
JOIN inv.items i USING (item_id)
JOIN inv.locations l ON l.location_id = p.location_id
LEFT JOIN inv.stock_balance b ON b.item_id = p.item_id AND b.location_id = p.location_id
WHERE i.is_active;

CREATE OR REPLACE VIEW inv.v_inv_usage_trend AS
WITH w AS (
  SELECT item_id, date_trunc('week', movement_date)::date AS week_start,
    SUM(CASE WHEN movement_type IN ('issue','consume','waste','transfer_out') THEN ABS(quantity) ELSE 0 END) AS units_consumed,
    SUM(CASE WHEN movement_type = 'receive' THEN quantity ELSE 0 END) AS units_received
  FROM inv.movements
  WHERE movement_date >= CURRENT_DATE - INTERVAL '12 weeks'
  GROUP BY item_id, date_trunc('week', movement_date)
)
SELECT item_id, week_start, units_consumed, units_received,
  ROUND(AVG(units_consumed) OVER (PARTITION BY item_id), 2) AS avg_weekly_consumed
FROM w;

CREATE OR REPLACE VIEW inv.v_inv_slow_movers AS
WITH consumption AS (
  SELECT item_id,
    SUM(CASE WHEN movement_type IN ('issue','consume','waste','transfer_out') THEN ABS(quantity) ELSE 0 END) AS units_90d
  FROM inv.movements
  WHERE movement_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY item_id
)
SELECT i.item_id, i.sku, i.item_name, i.category_id, c.name AS category_name,
  COALESCE(con.units_90d, 0)              AS units_90d,
  COALESCE(con.units_90d, 0) / 90.0       AS units_per_day,
  (COALESCE(con.units_90d, 0) / 90.0) * 7 AS units_per_week,
  i.last_unit_cost_usd,
  soh.total_on_hand,
  soh.value_usd_estimate
FROM inv.items i
JOIN inv.categories c USING (category_id)
LEFT JOIN consumption con ON con.item_id = i.item_id
LEFT JOIN inv.v_inv_stock_on_hand soh ON soh.item_id = i.item_id
WHERE i.is_active
  AND COALESCE(con.units_90d, 0) <= 5
  AND COALESCE(soh.total_on_hand, 0) > 0;

CREATE OR REPLACE VIEW inv.v_inv_days_of_cover AS
WITH burn AS (
  SELECT item_id,
    SUM(CASE WHEN movement_type IN ('issue','consume','waste','transfer_out') THEN ABS(quantity) ELSE 0 END) / 30.0 AS units_per_day_30d
  FROM inv.movements
  WHERE movement_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY item_id
)
SELECT i.item_id, i.sku, i.item_name,
  COALESCE(soh.total_on_hand, 0)   AS on_hand,
  COALESCE(b.units_per_day_30d, 0) AS burn_per_day,
  CASE WHEN COALESCE(b.units_per_day_30d, 0) = 0 THEN NULL
       ELSE ROUND(COALESCE(soh.total_on_hand, 0) / b.units_per_day_30d, 1) END AS days_of_cover,
  i.reorder_point,
  CASE WHEN COALESCE(b.units_per_day_30d, 0) = 0 OR i.reorder_point IS NULL THEN NULL
       ELSE ROUND((COALESCE(soh.total_on_hand, 0) - i.reorder_point) / NULLIF(b.units_per_day_30d, 0), 1) END AS days_until_reorder
FROM inv.items i
LEFT JOIN inv.v_inv_stock_on_hand soh ON soh.item_id = i.item_id
LEFT JOIN burn b ON b.item_id = i.item_id
WHERE i.is_active;

CREATE OR REPLACE VIEW inv.v_inv_expiring_soon AS
SELECT m.movement_id AS batch_movement_id, m.item_id, i.sku, i.item_name,
  m.location_id, l.location_name, m.batch_code, m.expiry_date,
  (m.expiry_date - CURRENT_DATE) AS days_until_expiry,
  m.quantity AS received_quantity,
  COALESCE(b.quantity_on_hand, 0) AS current_on_hand,
  i.last_unit_cost_usd,
  COALESCE(b.quantity_on_hand, 0) * COALESCE(i.last_unit_cost_usd, 0) AS at_risk_value_usd
FROM inv.movements m
JOIN inv.items i ON i.item_id = m.item_id
JOIN inv.locations l ON l.location_id = m.location_id
LEFT JOIN inv.stock_balance b ON b.item_id = m.item_id AND b.location_id = m.location_id
WHERE m.movement_type = 'receive'
  AND m.expiry_date IS NOT NULL
  AND m.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
  AND COALESCE(b.quantity_on_hand, 0) > 0;

CREATE OR REPLACE VIEW inv.v_inv_heatmap_health AS
SELECT l.location_id, l.location_name, c.category_id, c.name AS category_name,
  COUNT(*) FILTER (WHERE ps.par_status = 'stock_out')   AS stock_out_count,
  COUNT(*) FILTER (WHERE ps.par_status = 'reorder_now') AS reorder_count,
  COUNT(*) FILTER (WHERE ps.par_status = 'below_par')   AS below_par_count,
  COUNT(*) FILTER (WHERE ps.par_status = 'overstocked') AS overstocked_count,
  COUNT(*) FILTER (WHERE ps.par_status = 'ok')          AS ok_count,
  COUNT(*) AS total_items,
  CASE
    WHEN COUNT(*) FILTER (WHERE ps.par_status IN ('stock_out','reorder_now')) > 0 THEN 'red'
    WHEN COUNT(*) FILTER (WHERE ps.par_status = 'below_par')                    > 0 THEN 'amber'
    WHEN COUNT(*) FILTER (WHERE ps.par_status = 'overstocked')                  > 0 THEN 'blue'
    ELSE 'green'
  END AS health_color
FROM inv.locations l
CROSS JOIN inv.categories c
LEFT JOIN inv.v_inv_par_status ps
  ON ps.location_id = l.location_id
 AND ps.item_id IN (SELECT item_id FROM inv.items WHERE category_id = c.category_id)
WHERE l.is_active AND c.is_active
GROUP BY l.location_id, l.location_name, c.category_id, c.name;

ALTER TABLE inv.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.units          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.locations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.par_levels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.stock_balance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.counts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.count_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv.photos         ENABLE ROW LEVEL SECURITY;

CREATE POLICY inv_cat_read   ON inv.categories    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_cat_write  ON inv.categories    FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_unit_read  ON inv.units         FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_unit_write ON inv.units         FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_loc_read   ON inv.locations     FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_loc_write  ON inv.locations     FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_item_read  ON inv.items         FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_item_write ON inv.items         FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_par_read   ON inv.par_levels    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_par_write  ON inv.par_levels    FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_bal_read   ON inv.stock_balance FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_bal_write  ON inv.stock_balance FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_mov_read   ON inv.movements     FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_mov_write  ON inv.movements     FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_cnt_read   ON inv.counts        FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_cnt_write  ON inv.counts        FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_cl_read    ON inv.count_lines   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_cl_write   ON inv.count_lines   FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY inv_ph_read    ON inv.photos        FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_ph_write   ON inv.photos        FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

GRANT USAGE  ON SCHEMA inv TO authenticated, anon, service_role;
GRANT SELECT ON ALL TABLES    IN SCHEMA inv TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA inv TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA inv TO authenticated;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA inv TO authenticated;
GRANT ALL    ON ALL TABLES    IN SCHEMA inv TO service_role;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA inv TO service_role;

INSERT INTO inv.categories (code, name, description, usali_dept, default_shelf_life_days) VALUES
  ('FB_FOOD',     'F&B Food',                  'Fresh, frozen, and dry food stores',                'F&B',             14),
  ('FB_BEVERAGE', 'F&B Beverage',              'Beer, wine, spirits, soft drinks, mixers',          'F&B',            365),
  ('FB_SMALLW',   'F&B Smallwares',            'Disposable smallwares, foil, cling, kitchen paper', 'F&B',           NULL),
  ('LINEN',       'Linen & Towels',            'Bed linen, bath linen, F&B linen',                  'Rooms',         NULL),
  ('AMENITIES',   'Bathroom Amenities',        'Soap, shampoo, conditioner, body lotion',           'Rooms',         730),
  ('SPA_PROD',    'Spa Products / Consumables','Oils, scrubs, candles, single-use spa supplies',    'Other Operated',365),
  ('CLEANING',    'Cleaning Supplies',         'Chemicals, detergents, mops, gloves',               NULL,            NULL),
  ('OFFICE',      'Office Supplies',           'Stationery, printer ink, paper',                    NULL,            NULL),
  ('OSE',         'OS&E (Operating Equipment)','Glassware, cutlery, crockery, kitchen tools',       'F&B',           NULL),
  ('ENGINEERING', 'Engineering / Hardware',    'Light bulbs, fasteners, paint, plumbing fittings',  NULL,            NULL)
ON CONFLICT (code) DO NOTHING;

INSERT INTO inv.units (code, name, unit_class) VALUES
  ('ea',   'each',         'count'),
  ('set',  'set',          'count'),
  ('pcs',  'pieces',       'count'),
  ('box',  'box',          'count'),
  ('btl',  'bottle',       'count'),
  ('case', 'case',         'count'),
  ('roll', 'roll',         'count'),
  ('pkt',  'packet',       'count'),
  ('kg',   'kilogram',     'weight'),
  ('g',    'gram',         'weight'),
  ('l',    'litre',        'volume'),
  ('ml',   'millilitre',   'volume'),
  ('m',    'metre',        'length')
ON CONFLICT (code) DO NOTHING;

INSERT INTO inv.locations (code, location_name, area_type, responsible_dept) VALUES
  ('MAIN_STORE',   'Main Storage',     'main_storage', NULL),
  ('KITCHEN',      'Kitchen',          'kitchen',      'fb'),
  ('FB_STORE',     'F&B Storage',      'fb_outlet',    'fb'),
  ('HK_STORE',     'HK Storage',       'hk_storage',   'hk'),
  ('SPA_STORE',    'Spa Storage',      'spa_storage',  'spa'),
  ('POOL_BAR',     'Pool Bar',         'fb_outlet',    'fb'),
  ('PLANT_ROOM',   'Plant Room',       'plant_room',   'engineering')
ON CONFLICT (code) DO NOTHING;