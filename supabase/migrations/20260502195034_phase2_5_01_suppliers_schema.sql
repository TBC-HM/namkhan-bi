-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502195034
-- Name:    phase2_5_01_suppliers_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Phase 2.5 — 01_suppliers_schema
CREATE SCHEMA IF NOT EXISTS suppliers;
COMMENT ON SCHEMA suppliers IS 'Strategic supplier master. Sits above qb.vendors.';

CREATE TABLE IF NOT EXISTS suppliers.suppliers (
  supplier_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  legal_name           TEXT,
  supplier_type        TEXT CHECK (supplier_type IN ('manufacturer','wholesaler','distributor','local_market','service','contractor','other')),
  country              TEXT NOT NULL DEFAULT 'LA',
  province             TEXT,
  city                 TEXT,
  address              TEXT,
  distance_km          NUMERIC(8,2),
  is_local_sourcing    BOOLEAN NOT NULL DEFAULT false,
  email                TEXT,
  phone                TEXT,
  website              TEXT,
  tax_id               TEXT,
  bank_account         TEXT,
  payment_terms        TEXT,
  payment_terms_days   INT,
  currency             TEXT NOT NULL DEFAULT 'LAK',
  minimum_order_lak    NUMERIC(14,2),
  minimum_order_usd    NUMERIC(12,2),
  lead_time_days       INT,
  reliability_score    NUMERIC(3,1) CHECK (reliability_score IS NULL OR reliability_score BETWEEN 0 AND 5),
  quality_score        NUMERIC(3,1) CHECK (quality_score    IS NULL OR quality_score    BETWEEN 0 AND 5),
  sustainability_score NUMERIC(3,1) CHECK (sustainability_score IS NULL OR sustainability_score BETWEEN 0 AND 5),
  qb_vendor_ref        TEXT,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','terminated','prospect')),
  onboarded_date       DATE,
  last_review_date     DATE,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID DEFAULT auth.uid(),
  updated_by           UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_status     ON suppliers.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_qb_vendor  ON suppliers.suppliers(qb_vendor_ref) WHERE qb_vendor_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_local      ON suppliers.suppliers(is_local_sourcing) WHERE is_local_sourcing = true;

CREATE TABLE IF NOT EXISTS suppliers.contacts (
  contact_id           BIGSERIAL PRIMARY KEY,
  supplier_id          UUID NOT NULL REFERENCES suppliers.suppliers(supplier_id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  title                TEXT,
  email                TEXT,
  phone                TEXT,
  whatsapp             TEXT,
  is_primary           BOOLEAN NOT NULL DEFAULT false,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON suppliers.contacts(supplier_id);

CREATE TABLE IF NOT EXISTS suppliers.price_history (
  price_id             BIGSERIAL PRIMARY KEY,
  supplier_id          UUID NOT NULL REFERENCES suppliers.suppliers(supplier_id) ON DELETE CASCADE,
  inv_item_id          UUID,
  inv_sku              TEXT,
  effective_date       DATE NOT NULL,
  unit_price_lak       NUMERIC(14,2),
  unit_price_usd       NUMERIC(12,2),
  fx_rate_used         NUMERIC(14,4),
  min_order_qty        NUMERIC(12,3),
  source               TEXT CHECK (source IN ('qb_bill','manual','quote','contract','market_check')),
  source_ref           TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_prices_supplier ON suppliers.price_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_prices_item     ON suppliers.price_history(inv_item_id) WHERE inv_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_prices_date     ON suppliers.price_history(effective_date);

CREATE TABLE IF NOT EXISTS suppliers.alternates (
  alt_id               BIGSERIAL PRIMARY KEY,
  primary_supplier_id  UUID NOT NULL REFERENCES suppliers.suppliers(supplier_id) ON DELETE CASCADE,
  alternate_supplier_id UUID NOT NULL REFERENCES suppliers.suppliers(supplier_id) ON DELETE CASCADE,
  preference_rank      INT NOT NULL DEFAULT 1,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (primary_supplier_id, alternate_supplier_id),
  CHECK (primary_supplier_id <> alternate_supplier_id)
);

CREATE OR REPLACE VIEW suppliers.v_supplier_summary AS
SELECT
  s.*,
  (SELECT count(*) FROM suppliers.contacts WHERE supplier_id = s.supplier_id) AS contact_count,
  (SELECT count(DISTINCT inv_item_id) FROM suppliers.price_history WHERE supplier_id = s.supplier_id) AS items_supplied,
  (SELECT max(effective_date) FROM suppliers.price_history WHERE supplier_id = s.supplier_id) AS last_price_update,
  (SELECT count(*) FROM suppliers.alternates WHERE primary_supplier_id = s.supplier_id) AS alternate_count
FROM suppliers.suppliers s;

CREATE OR REPLACE VIEW suppliers.v_local_sourcing_pct AS
SELECT
  count(*) FILTER (WHERE is_local_sourcing) AS local_supplier_count,
  count(*)                                  AS total_supplier_count,
  ROUND(100.0 * count(*) FILTER (WHERE is_local_sourcing) / NULLIF(count(*),0), 1) AS local_supplier_pct
FROM suppliers.suppliers
WHERE status = 'active';

ALTER TABLE suppliers.suppliers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers.contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers.price_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers.alternates     ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_read       ON suppliers.suppliers     FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY suppliers_write      ON suppliers.suppliers     FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY supplier_contacts_read  ON suppliers.contacts   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY supplier_contacts_write ON suppliers.contacts   FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY supplier_prices_read    ON suppliers.price_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY supplier_prices_write   ON suppliers.price_history FOR ALL  USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));
CREATE POLICY supplier_alt_read       ON suppliers.alternates FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY supplier_alt_write      ON suppliers.alternates FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

GRANT USAGE  ON SCHEMA suppliers TO authenticated, anon, service_role;
GRANT SELECT ON ALL TABLES    IN SCHEMA suppliers TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA suppliers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA suppliers TO authenticated;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA suppliers TO authenticated;
GRANT ALL    ON ALL TABLES    IN SCHEMA suppliers TO service_role;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA suppliers TO service_role;