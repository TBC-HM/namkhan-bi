-- ============================================================================
-- Migration: 02_fa_schema  (Fixed Assets — register, depreciation, capex)
-- Version:   20260502230011
-- Date:      2026-05-02
-- DEPENDS ON: suppliers (FK target on assets.supplier_id, capex.preferred_supplier_id)
-- ============================================================================
-- Implements pages: /ops/inventory/assets, /ops/inventory/assets/[id], /ops/inventory/capex
-- View v_fa_depreciation_current is required by the Overview page KPI strip.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS fa;
COMMENT ON SCHEMA fa IS 'Fixed Assets — FF&E + plant + vehicles. Includes capex pipeline and depreciation view.';

-- ----------------------------------------------------------------------------
-- 1. fa.categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fa.categories (
  category_id          BIGSERIAL PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  description          TEXT,
  usali_dept           TEXT,                            -- soft string
  default_useful_life_years INT NOT NULL DEFAULT 5 CHECK (default_useful_life_years > 0),
  default_depreciation_method TEXT NOT NULL DEFAULT 'straight_line' CHECK (default_depreciation_method IN ('straight_line','declining_balance','units_of_production','none')),
  individual_threshold_usd NUMERIC(12,2) NOT NULL DEFAULT 500.00,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. fa.assets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fa.assets (
  asset_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag            TEXT NOT NULL UNIQUE,            -- e.g. "FA-SOL-001"
  name                 TEXT NOT NULL,
  category_id          BIGINT NOT NULL REFERENCES fa.categories(category_id) ON DELETE RESTRICT,
  -- Location (text; may FK to inv.locations once that exists)
  location             TEXT,
  location_id          BIGINT,                          -- soft FK to inv.locations
  room_id              BIGINT,                          -- soft FK to public.rooms
  -- Acquisition
  supplier_id          UUID REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL,
  serial_number        TEXT,
  manufacturer         TEXT,
  model                TEXT,
  acquired_via         TEXT CHECK (acquired_via IN ('purchase','lease','donation','transfer','opening_stock')),
  purchase_date        DATE,
  in_service_date      DATE,
  purchase_cost_lak    NUMERIC(14,2),
  purchase_cost_usd    NUMERIC(12,2),
  fx_rate_used         NUMERIC(14,4),
  -- Depreciation
  useful_life_years    INT,
  depreciation_method  TEXT CHECK (depreciation_method IN ('straight_line','declining_balance','units_of_production','none')),
  residual_value_usd   NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Insurance + warranty
  insurance_value_usd  NUMERIC(12,2),
  warranty_expiry      DATE,
  -- Lifecycle
  status               TEXT NOT NULL DEFAULT 'in_service' CHECK (status IN ('in_service','in_storage','out_for_repair','retired','written_off','lost','stolen','disposed')),
  condition            TEXT CHECK (condition IN ('excellent','good','fair','poor','out_of_service')),
  disposal_date        DATE,
  disposal_value_usd   NUMERIC(12,2),
  -- GL link (the spec wants Source GL acct on item detail)
  gl_account_code      TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID DEFAULT auth.uid(),
  updated_by           UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_fa_assets_category   ON fa.assets(category_id);
CREATE INDEX IF NOT EXISTS idx_fa_assets_status     ON fa.assets(status);
CREATE INDEX IF NOT EXISTS idx_fa_assets_supplier   ON fa.assets(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fa_assets_warranty   ON fa.assets(warranty_expiry) WHERE warranty_expiry IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. fa.asset_movements (transfer / retire / dispose log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fa.asset_movements (
  movement_id          BIGSERIAL PRIMARY KEY,
  asset_id             UUID NOT NULL REFERENCES fa.assets(asset_id) ON DELETE CASCADE,
  movement_type        TEXT NOT NULL CHECK (movement_type IN ('transfer','retire','dispose','reactivate','write_off','condition_update')),
  from_location        TEXT,
  to_location          TEXT,
  moved_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  moved_by             UUID DEFAULT auth.uid(),
  reason               TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fa_movements_asset ON fa.asset_movements(asset_id);

-- ----------------------------------------------------------------------------
-- 4. fa.maintenance_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fa.maintenance_log (
  log_id               BIGSERIAL PRIMARY KEY,
  asset_id             UUID NOT NULL REFERENCES fa.assets(asset_id) ON DELETE CASCADE,
  event_type           TEXT NOT NULL CHECK (event_type IN ('preventive','corrective','inspection','warranty_claim','calibration','breakdown','routine')),
  event_date           DATE NOT NULL,
  vendor_id            UUID REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL,
  cost_lak             NUMERIC(12,2),
  cost_usd             NUMERIC(10,2),
  fx_rate_used         NUMERIC(14,4),
  description          TEXT,
  next_due_date        DATE,
  performed_by         TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_fa_mlog_asset ON fa.maintenance_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_fa_mlog_due   ON fa.maintenance_log(next_due_date) WHERE next_due_date IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. fa.documents (invoices, warranties, photos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fa.documents (
  document_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id             UUID NOT NULL REFERENCES fa.assets(asset_id) ON DELETE CASCADE,
  document_type        TEXT NOT NULL CHECK (document_type IN ('invoice','warranty','photo','manual','certificate','insurance_policy','other')),
  storage_path         TEXT NOT NULL,
  filename             TEXT NOT NULL,
  mime_type            TEXT,
  file_size_bytes      BIGINT,
  notes                TEXT,
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by          UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_fa_docs_asset ON fa.documents(asset_id);
CREATE INDEX IF NOT EXISTS idx_fa_docs_type  ON fa.documents(document_type);

-- ----------------------------------------------------------------------------
-- 6. fa.capex_pipeline  (kanban — proposed → review → approved → ordered → received)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fa.capex_pipeline (
  capex_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capex_code           TEXT UNIQUE,                     -- e.g. "CAPEX-2026-007", optional
  fiscal_year          INT NOT NULL,
  fiscal_quarter       INT CHECK (fiscal_quarter IS NULL OR fiscal_quarter BETWEEN 1 AND 4),
  title                TEXT NOT NULL,
  description          TEXT,
  category_id          BIGINT REFERENCES fa.categories(category_id) ON DELETE SET NULL,
  estimated_cost_lak   NUMERIC(14,2),
  estimated_cost_usd   NUMERIC(12,2),
  fx_rate_used         NUMERIC(14,4),
  preferred_supplier_id UUID REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL,
  -- Business case
  expected_irr_pct     NUMERIC(6,2),
  payback_months       NUMERIC(6,1),
  expected_useful_life_years INT,
  business_case        TEXT,
  -- Workflow status
  status               TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','under_review','approved','rejected','ordered','received','cancelled')),
  proposed_by          UUID DEFAULT auth.uid(),
  proposed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by          UUID,
  reviewed_at          TIMESTAMPTZ,
  approved_by          UUID,
  approved_at          TIMESTAMPTZ,
  rejected_reason      TEXT,
  -- Linkage when realized
  converted_to_asset_id UUID REFERENCES fa.assets(asset_id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capex_status   ON fa.capex_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_capex_fy       ON fa.capex_pipeline(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_capex_category ON fa.capex_pipeline(category_id) WHERE category_id IS NOT NULL;

-- ============================================================================
-- VIEW: v_fa_depreciation_current
-- ============================================================================
CREATE OR REPLACE VIEW fa.v_fa_depreciation_current AS
SELECT
  a.asset_id,
  a.asset_tag,
  a.name,
  a.category_id,
  c.name AS category_name,
  c.usali_dept,
  a.location,
  a.purchase_date,
  a.in_service_date,
  a.purchase_cost_usd,
  a.residual_value_usd,
  COALESCE(a.useful_life_years,    c.default_useful_life_years)    AS useful_life_years,
  COALESCE(a.depreciation_method, c.default_depreciation_method) AS depreciation_method,
  GREATEST(0, COALESCE(a.purchase_cost_usd,0) - COALESCE(a.residual_value_usd,0)) AS depreciable_base_usd,
  CASE
    WHEN a.in_service_date IS NULL THEN NULL
    ELSE ROUND(((CURRENT_DATE - a.in_service_date)::numeric / 365.25)::numeric, 2)
  END AS years_in_service,
  -- Straight-line book value, floored at residual; other methods fall back to straight-line for now.
  CASE
    WHEN a.in_service_date IS NULL OR a.purchase_cost_usd IS NULL THEN NULL
    ELSE GREATEST(
      COALESCE(a.residual_value_usd, 0),
      a.purchase_cost_usd
        - GREATEST(0, a.purchase_cost_usd - COALESCE(a.residual_value_usd,0))
          * LEAST(1.0, ((CURRENT_DATE - a.in_service_date)::numeric / 365.25)
                       / NULLIF(COALESCE(a.useful_life_years, c.default_useful_life_years),0))
    )
  END AS book_value_usd,
  -- Monthly depreciation amount
  CASE
    WHEN COALESCE(a.useful_life_years, c.default_useful_life_years, 0) = 0 THEN 0
    ELSE ROUND(GREATEST(0, COALESCE(a.purchase_cost_usd,0) - COALESCE(a.residual_value_usd,0))
               / NULLIF(COALESCE(a.useful_life_years, c.default_useful_life_years) * 12, 0), 2)
  END AS monthly_depreciation_usd,
  to_char(date_trunc('month', CURRENT_DATE), 'YYYYMM')::int AS period_yyyymm,
  a.status
FROM fa.assets a
JOIN fa.categories c USING (category_id)
WHERE a.status IN ('in_service','in_storage');
COMMENT ON VIEW fa.v_fa_depreciation_current IS 'Current NBV per asset, straight-line. period_yyyymm=current month for spec compatibility.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE fa.categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fa.assets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fa.asset_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fa.maintenance_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fa.documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fa.capex_pipeline   ENABLE ROW LEVEL SECURITY;

CREATE POLICY fa_cat_read    ON fa.categories      FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fa_cat_write   ON fa.categories      FOR ALL USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY fa_assets_read ON fa.assets          FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fa_assets_write ON fa.assets         FOR ALL USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY fa_mov_read    ON fa.asset_movements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fa_mov_write   ON fa.asset_movements FOR ALL USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY fa_mlog_read   ON fa.maintenance_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fa_mlog_write  ON fa.maintenance_log FOR ALL USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY fa_docs_read   ON fa.documents       FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fa_docs_write  ON fa.documents       FOR ALL USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY fa_capex_read  ON fa.capex_pipeline  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fa_capex_write ON fa.capex_pipeline  FOR ALL USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT USAGE  ON SCHEMA fa TO authenticated, anon, service_role;
GRANT SELECT ON ALL TABLES    IN SCHEMA fa TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA fa TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA fa TO authenticated;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA fa TO authenticated;
GRANT ALL    ON ALL TABLES    IN SCHEMA fa TO service_role;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA fa TO service_role;

-- ============================================================================
-- SEED  (8 categories)
-- ============================================================================
INSERT INTO fa.categories (code, name, description, usali_dept, default_useful_life_years, default_depreciation_method, individual_threshold_usd) VALUES
  ('BUILDING',     'Building & structure',         'Main building, outbuildings, structural improvements',  NULL,             40, 'straight_line', 5000),
  ('FFE_GUEST',    'FF&E — Guest Rooms',           'Beds, wardrobes, in-room furniture',                    'Rooms',          10, 'straight_line', 500),
  ('FFE_PUBLIC',   'FF&E — Public Areas',          'Lobby, restaurant, lounge, pool deck',                  'Rooms',          10, 'straight_line', 500),
  ('FFE_SPA',      'FF&E — Spa',                   'Massage tables, sauna, treatment beds',                 'Other Operated', 10, 'straight_line', 500),
  ('PLANT',        'Plant & equipment',            'HVAC, generators, water treatment, solar inverters',    NULL,             10, 'straight_line', 500),
  ('VEHICLES',     'Vehicles',                     'Tuk-tuk, boats, scooters, bicycles',                    NULL,              7, 'straight_line', 500),
  ('IT_POS',       'IT / POS',                     'Servers, laptops, network gear, POS terminals',         NULL,               4, 'straight_line', 500),
  ('LAND',         'Land',                         'Land — non-depreciable',                                NULL,             0, 'none', 0)
ON CONFLICT (code) DO NOTHING;

-- end 02_fa_schema
