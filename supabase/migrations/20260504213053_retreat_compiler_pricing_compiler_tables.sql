-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504213053
-- Name:    retreat_compiler_pricing_compiler_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS pricing.pricelist (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku               text NOT NULL,
  item_name         text NOT NULL,
  source_table      text NOT NULL CHECK (source_table IN ('catalog.activities','catalog.spa_treatments','catalog.fnb_items','catalog.fnb_menus','catalog.transport_options','catalog.addons','catalog.ceremonies','catalog.workshops','cloudbeds.rooms')),
  source_id         text NOT NULL,
  sell_price_usd    numeric NOT NULL,
  cost_lak          numeric NOT NULL DEFAULT 0,
  margin_pct        numeric GENERATED ALWAYS AS (
    CASE WHEN sell_price_usd > 0 THEN (sell_price_usd - cost_lak/20850.0) / sell_price_usd * 100 ELSE 0 END
  ) STORED,
  margin_floor_pct  numeric NOT NULL DEFAULT 35,
  valid_from        date NOT NULL,
  valid_to          date,
  tier_visibility   text[] NOT NULL DEFAULT ARRAY['budget','mid','lux'],
  property_id       text NOT NULL DEFAULT 'namkhan',
  usali_category    text,
  override_reason   text,
  override_by       uuid,
  override_at       timestamptz,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sku, valid_from, property_id)
);
DROP TRIGGER IF EXISTS set_pricing_pricelist_updated_at ON pricing.pricelist;
CREATE TRIGGER set_pricing_pricelist_updated_at BEFORE UPDATE ON pricing.pricelist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_pricing_pricelist_sku_valid ON pricing.pricelist(sku, valid_from);
CREATE INDEX IF NOT EXISTS idx_pricing_pricelist_tier ON pricing.pricelist USING gin(tier_visibility);
CREATE INDEX IF NOT EXISTS idx_pricing_pricelist_active ON pricing.pricelist(is_active, valid_from) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS pricing.seasons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_name       text NOT NULL,
  property_id       text NOT NULL DEFAULT 'namkhan',
  date_from         date NOT NULL,
  date_to           date NOT NULL,
  rate_multiplier   numeric NOT NULL DEFAULT 1.0,
  min_stay          int NOT NULL DEFAULT 1,
  applies_to        text[] NOT NULL DEFAULT ARRAY['rooms','activities','spa','fnb'],
  is_blackout       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK(date_to >= date_from)
);
DROP TRIGGER IF EXISTS set_pricing_seasons_updated_at ON pricing.seasons;
CREATE TRIGGER set_pricing_seasons_updated_at BEFORE UPDATE ON pricing.seasons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_pricing_seasons_window ON pricing.seasons(property_id, date_from, date_to);

CREATE TABLE IF NOT EXISTS pricing.fx_locks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency     text NOT NULL DEFAULT 'LAK',
  quote_currency    text NOT NULL DEFAULT 'USD',
  rate              numeric NOT NULL,
  locked_at         timestamptz NOT NULL DEFAULT now(),
  locked_until      timestamptz NOT NULL,
  source            text NOT NULL CHECK (source IN ('cloudbeds','manual','api')),
  locked_by         uuid,
  run_id            uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_fx_until ON pricing.fx_locks(locked_until DESC);

CREATE TABLE IF NOT EXISTS pricing.margin_overrides (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid,
  variant_id        uuid,
  sku               text,
  breach_type       text NOT NULL CHECK (breach_type IN ('activities','rooms','fnb','spa','other')),
  floor_pct         numeric NOT NULL,
  actual_pct        numeric NOT NULL,
  override_reason   text NOT NULL,
  approved_by       uuid NOT NULL,
  approved_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compiler.runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt            text NOT NULL,
  parsed_spec       jsonb NOT NULL DEFAULT '{}',
  status            text NOT NULL CHECK (status IN ('draft','compiling','ready','rendering','deployed','halted')) DEFAULT 'draft',
  operator_id       uuid,
  property_id       text NOT NULL DEFAULT 'namkhan',
  cost_eur          numeric NOT NULL DEFAULT 0,
  tokens_in         int DEFAULT 0,
  tokens_out        int DEFAULT 0,
  model             text,
  parent_run_id     uuid REFERENCES compiler.runs(id) ON DELETE SET NULL,
  halt_reason       text,
  halt_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_compiler_runs_updated_at ON compiler.runs;
CREATE TRIGGER set_compiler_runs_updated_at BEFORE UPDATE ON compiler.runs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_compiler_runs_operator ON compiler.runs(operator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compiler_runs_status ON compiler.runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS compiler.variants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES compiler.runs(id) ON DELETE CASCADE,
  label             text NOT NULL,
  room_category     text,
  activity_intensity text,
  fnb_mode          text,
  total_usd         numeric NOT NULL,
  per_pax_usd       numeric NOT NULL,
  margin_pct        numeric NOT NULL,
  occ_assumption_pct int,
  day_structure     jsonb NOT NULL DEFAULT '[]',
  usali_split       jsonb,
  bookable_rooms    jsonb NOT NULL DEFAULT '[]',
  bookable_boards   jsonb NOT NULL DEFAULT '[]',
  bookable_program  jsonb NOT NULL DEFAULT '[]',
  bookable_addons   jsonb NOT NULL DEFAULT '[]',
  guest_savings_floor_usd numeric,
  recommended       boolean DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_compiler_variants_updated_at ON compiler.variants;
CREATE TRIGGER set_compiler_variants_updated_at BEFORE UPDATE ON compiler.variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_compiler_variants_run ON compiler.variants(run_id);

CREATE TABLE IF NOT EXISTS compiler.itinerary_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name     text NOT NULL,
  slug              text NOT NULL UNIQUE,
  theme             text NOT NULL,
  tier              text NOT NULL CHECK (tier IN ('budget','mid','lux')),
  duration_nights   int NOT NULL,
  season            text[] NOT NULL DEFAULT '{}',
  lunar_required    boolean DEFAULT false,
  day_structure     jsonb NOT NULL,
  property_id       text NOT NULL DEFAULT 'namkhan',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_compiler_itinerary_updated_at ON compiler.itinerary_templates;
CREATE TRIGGER set_compiler_itinerary_updated_at BEFORE UPDATE ON compiler.itinerary_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS compiler.deploys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES compiler.runs(id) ON DELETE CASCADE,
  variant_id        uuid NOT NULL REFERENCES compiler.variants(id) ON DELETE CASCADE,
  design_variant    text NOT NULL CHECK (design_variant IN ('A','B','C')),
  subdomain         text NOT NULL,
  vercel_project_id text,
  vercel_deployment_id text,
  status            text NOT NULL CHECK (status IN ('queued','provisioning','live','failed','rolled_back')) DEFAULT 'queued',
  deployed_at       timestamptz,
  rolled_back_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_compiler_deploys_updated_at ON compiler.deploys;
CREATE TRIGGER set_compiler_deploys_updated_at BEFORE UPDATE ON compiler.deploys
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_compiler_deploys_subdomain ON compiler.deploys(subdomain);
CREATE INDEX IF NOT EXISTS idx_compiler_deploys_status ON compiler.deploys(status) WHERE status IN ('queued','provisioning');