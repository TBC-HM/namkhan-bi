-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503000630
-- Name:    sales_activity_catalog
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DO $$ BEGIN
  CREATE TYPE sales.activity_kind AS ENUM ('internal','external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sales.activity_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  glyph           TEXT,
  sort_order      INT NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS sales.activity_partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     BIGINT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  partner_type    TEXT NOT NULL,
  contact_email   TEXT,
  contact_phone   TEXT,
  whatsapp        TEXT,
  default_commission_pct NUMERIC(5,2),
  payment_terms   TEXT,
  dmc_contract_id UUID REFERENCES governance.dmc_contracts(contract_id),
  ops_vendor_id   UUID,
  status          TEXT NOT NULL DEFAULT 'active',
  notes_md        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales.activity_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     BIGINT NOT NULL,
  kind            sales.activity_kind NOT NULL,
  partner_id      UUID REFERENCES sales.activity_partners(id),
  category_id     UUID REFERENCES sales.activity_categories(id),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  short_summary   TEXT,
  description_md  TEXT,
  duration_min    INT,
  capacity_max    INT,
  capacity_min    INT,
  lead_time_hours INT NOT NULL DEFAULT 24,
  cancellation_md TEXT,
  cost_lak        NUMERIC(12,2),
  sell_lak        NUMERIC(12,2) NOT NULL,
  margin_pct      NUMERIC(5,2) GENERATED ALWAYS AS (
                    CASE WHEN sell_lak > 0 AND cost_lak IS NOT NULL
                         THEN ((sell_lak - cost_lak) / sell_lak * 100.0)
                         ELSE NULL END
                  ) STORED,
  currency        TEXT NOT NULL DEFAULT 'LAK',
  languages       JSONB NOT NULL DEFAULT '["en"]'::jsonb,
  days_of_week    JSONB NOT NULL DEFAULT '[1,2,3,4,5,6,7]'::jsonb,
  season_from     INT,
  season_to       INT,
  weather_dependent BOOLEAN NOT NULL DEFAULT false,
  hero_asset_id   UUID REFERENCES marketing.media_assets(asset_id),
  gallery_asset_ids UUID[],
  ics_template    JSONB,
  status          TEXT NOT NULL DEFAULT 'active',
  popularity_score NUMERIC(5,2),
  is_signature    BOOLEAN NOT NULL DEFAULT false,
  sort_order      INT NOT NULL DEFAULT 100,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_prop_status ON sales.activity_catalog (property_id, status, kind);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON sales.activity_catalog (category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_catalog_popularity ON sales.activity_catalog (popularity_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_catalog_signature ON sales.activity_catalog (is_signature, popularity_score DESC NULLS LAST);