-- =====================================================================
-- Migration: 20260504000000_retreat_compiler_init_a1b2c3d4
-- Feature: retreat-compiler (Stage 2.5 / 4)
-- Approved: 2026-05-04 (rev 1)
-- Classification: SAFE (all CREATE; no ALTER, no DROP, no type change)
-- Apply to: STAGING first, then PROD after RLS + smoke tests pass
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Schemas + extensions
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS pricing;
CREATE SCHEMA IF NOT EXISTS compiler;
CREATE SCHEMA IF NOT EXISTS book;
CREATE SCHEMA IF NOT EXISTS web;
CREATE SCHEMA IF NOT EXISTS content;

CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- text search
CREATE EXTENSION IF NOT EXISTS btree_gin;    -- mixed-type GIN

-- ---------------------------------------------------------------------
-- 1. Shared trigger function
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ---------------------------------------------------------------------
-- 2. CONTENT (reference data, low write)
-- ---------------------------------------------------------------------

CREATE TABLE content.series (
  slug              text PRIMARY KEY,
  name              text NOT NULL,
  name_lo           text,
  description_md    text,
  color_token       text,
  lunar_aware       boolean NOT NULL DEFAULT false,
  default_themes    text[] NOT NULL DEFAULT '{}',
  photo_urls        text[] NOT NULL DEFAULT '{}',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_content_series_updated_at BEFORE UPDATE ON content.series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE content.lunar_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date        date NOT NULL UNIQUE,
  event_type        text NOT NULL CHECK (event_type IN ('full_moon','new_moon','first_quarter','last_quarter')),
  event_time_local  time,
  lunar_phase_pct   numeric,
  buddhist_holiday  text,
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lunar_events_date ON content.lunar_events(event_date);

CREATE TABLE content.usali_categories (
  slug              text PRIMARY KEY,
  display_name      text NOT NULL,
  usali_section     text NOT NULL,
  usali_department  text,
  is_revenue_center boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content.legal_pages (
  slug              text PRIMARY KEY,
  title             text NOT NULL,
  body_md           text NOT NULL,
  version           text NOT NULL,
  effective_date    date NOT NULL,
  supersedes_version text,
  language          text NOT NULL DEFAULT 'en',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_content_legal_pages_updated_at BEFORE UPDATE ON content.legal_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- 3. CATALOG
-- ---------------------------------------------------------------------

CREATE TABLE catalog.vendors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  type              text NOT NULL CHECK (type IN ('internal','partner')),
  legal_entity      text,
  country           text,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  contact_whatsapp  text,
  default_commission_pct numeric DEFAULT 0,
  payment_terms_days int DEFAULT 30,
  currency          text DEFAULT 'LAK',
  contract_url      text,
  contract_expires_on date,
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_vendors_updated_at BEFORE UPDATE ON catalog.vendors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_catalog_vendors_active ON catalog.vendors(is_active) WHERE is_active = true;

CREATE TABLE catalog.vendor_rate_cards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         uuid NOT NULL REFERENCES catalog.vendors(id) ON DELETE CASCADE,
  version           int NOT NULL,
  valid_from        date NOT NULL,
  valid_to          date,
  rate_card_url     text,
  source            text NOT NULL CHECK (source IN ('manual','email','portal')),
  notes             text,
  snapshot_jsonb    jsonb,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, version)
);

CREATE TABLE catalog.activities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  name_lo           text,
  slug              text NOT NULL UNIQUE,
  category          text NOT NULL CHECK (category IN ('wellness','cultural','adventure','culinary','spiritual','workshop','ceremony')),
  series_tags       text[] NOT NULL DEFAULT '{}',
  duration_min      int,
  prep_time_min     int DEFAULT 0,
  debrief_time_min  int DEFAULT 0,
  capacity_min      int,
  capacity_max      int,
  location_type     text CHECK (location_type IN ('onsite','offsite','river','partner_site')),
  location_name     text,
  gps_lat           numeric,
  gps_lng           numeric,
  pickup_required   boolean DEFAULT false,
  pickup_time_min   int,
  vendor_id         uuid REFERENCES catalog.vendors(id) ON DELETE SET NULL,
  cost_lak          numeric NOT NULL DEFAULT 0,
  sell_price_usd    numeric NOT NULL DEFAULT 0,
  margin_pct        numeric GENERATED ALWAYS AS (
    CASE WHEN sell_price_usd > 0 THEN (sell_price_usd - cost_lak/20850.0) / sell_price_usd * 100 ELSE 0 END
  ) STORED,
  seasonality       text[] NOT NULL DEFAULT '{}',
  weather_rules     jsonb,
  lunar_dependent   boolean DEFAULT false,
  lunar_window_days int DEFAULT 0,
  tier_visibility   text[] NOT NULL DEFAULT ARRAY['budget','mid','lux'],
  description       text,
  description_long_md text,
  photo_urls        text[] NOT NULL DEFAULT '{}',
  hero_asset_id     uuid,
  booking_lead_time_hr int DEFAULT 24,
  cancellation_window_hr int DEFAULT 48,
  usali_category    text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_activities_updated_at BEFORE UPDATE ON catalog.activities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_catalog_activities_series_tags ON catalog.activities USING gin(series_tags);
CREATE INDEX idx_catalog_activities_seasonality ON catalog.activities USING gin(seasonality);
CREATE INDEX idx_catalog_activities_lunar ON catalog.activities(lunar_dependent) WHERE lunar_dependent = true;
CREATE INDEX idx_catalog_activities_active ON catalog.activities(is_active) WHERE is_active = true;

CREATE TABLE catalog.spa_treatments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_name    text NOT NULL,
  name_lo           text,
  slug              text NOT NULL UNIQUE,
  category          text NOT NULL CHECK (category IN ('massage','facial','body','ritual','package')),
  duration_min      int NOT NULL,
  sell_price_usd    numeric NOT NULL,
  cost_lak          numeric NOT NULL DEFAULT 0,
  margin_pct        numeric GENERATED ALWAYS AS (
    CASE WHEN sell_price_usd > 0 THEN (sell_price_usd - cost_lak/20850.0) / sell_price_usd * 100 ELSE 0 END
  ) STORED,
  therapist_required int DEFAULT 1,
  room_required     text,
  capacity_per_day  int,
  ingredients       text[],
  contraindications text[],
  pre_treatment_form_url text,
  combinable_with   text[],
  photo_urls        text[] DEFAULT '{}',
  hero_asset_id     uuid,
  usali_category    text DEFAULT 'Spa',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_spa_updated_at BEFORE UPDATE ON catalog.spa_treatments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE catalog.fnb_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name         text NOT NULL,
  name_lo           text,
  slug              text NOT NULL UNIQUE,
  menu_section      text NOT NULL CHECK (menu_section IN ('breakfast','lunch','dinner','snack','drink_alc','drink_nonalc','amuse','dessert')),
  outlet            text NOT NULL CHECK (outlet IN ('the_roots','in_villa','riverdeck','special_event','partner')),
  sell_price_usd    numeric NOT NULL,
  food_cost_lak     numeric NOT NULL DEFAULT 0,
  food_cost_pct     numeric GENERATED ALWAYS AS (
    CASE WHEN sell_price_usd > 0 THEN (food_cost_lak/20850.0) / sell_price_usd * 100 ELSE 0 END
  ) STORED,
  cost_pct_floor    numeric DEFAULT 35,
  dietary_tags      text[] DEFAULT '{}',
  allergens         text[] DEFAULT '{}',
  spice_level       int CHECK (spice_level BETWEEN 1 AND 5),
  serves_pax        int DEFAULT 1,
  seasonality       text[] DEFAULT '{}',
  sourcing_local_pct int CHECK (sourcing_local_pct BETWEEN 0 AND 100),
  photo_urls        text[] DEFAULT '{}',
  hero_asset_id     uuid,
  usali_category    text DEFAULT 'F&B',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_fnb_items_updated_at BEFORE UPDATE ON catalog.fnb_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_catalog_fnb_dietary ON catalog.fnb_items USING gin(dietary_tags);

CREATE TABLE catalog.fnb_menus (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_name         text NOT NULL,
  slug              text NOT NULL UNIQUE,
  menu_type         text NOT NULL CHECK (menu_type IN ('set_menu','group_menu','tasting','chef_table','all_inclusive')),
  serves_pax        int NOT NULL DEFAULT 1,
  courses           int,
  sell_price_usd    numeric NOT NULL,
  computed_food_cost_lak numeric DEFAULT 0,
  margin_pct        numeric GENERATED ALWAYS AS (
    CASE WHEN sell_price_usd > 0 THEN (sell_price_usd - computed_food_cost_lak/20850.0) / sell_price_usd * 100 ELSE 0 END
  ) STORED,
  items             jsonb NOT NULL DEFAULT '[]',
  description       text,
  description_long_md text,
  photo_urls        text[] DEFAULT '{}',
  hero_asset_id     uuid,
  usali_category    text DEFAULT 'F&B',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_fnb_menus_updated_at BEFORE UPDATE ON catalog.fnb_menus
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE catalog.transport_options (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  mode              text NOT NULL CHECK (mode IN ('sedan','van','minibus','bus','river_boat','long_tail','helicopter','tuk_tuk','bicycle','walk')),
  capacity_pax      int NOT NULL,
  duration_min      int,
  route_from        text,
  route_to          text,
  vendor_id         uuid REFERENCES catalog.vendors(id) ON DELETE SET NULL,
  sell_price_usd    numeric NOT NULL,
  cost_lak          numeric NOT NULL DEFAULT 0,
  margin_pct        numeric GENERATED ALWAYS AS (
    CASE WHEN sell_price_usd > 0 THEN (sell_price_usd - cost_lak/20850.0) / sell_price_usd * 100 ELSE 0 END
  ) STORED,
  includes_driver   boolean DEFAULT true,
  includes_fuel     boolean DEFAULT true,
  includes_water    boolean DEFAULT true,
  luggage_max_kg    int,
  seasonality       text[] DEFAULT '{}',
  photo_urls        text[] DEFAULT '{}',
  usali_category    text DEFAULT 'Minor Operated',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_transport_updated_at BEFORE UPDATE ON catalog.transport_options
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE catalog.addons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  addon_type        text NOT NULL CHECK (addon_type IN ('photo_video','supplement','gift','service','product','in_room')),
  sell_price_usd    numeric NOT NULL,
  cost_lak          numeric NOT NULL DEFAULT 0,
  unit              text NOT NULL CHECK (unit IN ('per_pax','per_room','per_night','per_event','flat')),
  tier_visibility   text[] NOT NULL DEFAULT ARRAY['budget','mid','lux'],
  description       text,
  photo_urls        text[] DEFAULT '{}',
  hero_asset_id     uuid,
  usali_category    text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_addons_updated_at BEFORE UPDATE ON catalog.addons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE catalog.ceremonies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  name_lo           text,
  slug              text NOT NULL UNIQUE,
  ceremony_type     text NOT NULL CHECK (ceremony_type IN ('alms','full_moon','baci','welcome','closing','water_blessing','merit_making')),
  duration_min      int,
  officiant_required text,
  lunar_dependent   boolean DEFAULT false,
  lunar_phases      text[] DEFAULT '{}',
  respectful_attire_required boolean DEFAULT true,
  photo_permitted   boolean DEFAULT true,
  sell_price_usd    numeric NOT NULL,
  cost_lak          numeric NOT NULL DEFAULT 0,
  margin_pct        numeric GENERATED ALWAYS AS (
    CASE WHEN sell_price_usd > 0 THEN (sell_price_usd - cost_lak/20850.0) / sell_price_usd * 100 ELSE 0 END
  ) STORED,
  description       text,
  description_long_md text,
  photo_urls        text[] DEFAULT '{}',
  usali_category    text DEFAULT 'Other Operated',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_ceremonies_updated_at BEFORE UPDATE ON catalog.ceremonies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE catalog.workshops (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  name_lo           text,
  slug              text NOT NULL UNIQUE,
  workshop_type     text NOT NULL CHECK (workshop_type IN ('weaving','cooking','calligraphy','foraging','pottery','music','other')),
  duration_min      int NOT NULL,
  skill_level       text NOT NULL CHECK (skill_level IN ('beginner','intermediate','advanced','all')),
  materials_provided boolean DEFAULT true,
  take_home_item    boolean DEFAULT true,
  capacity_min      int,
  capacity_max      int,
  vendor_id         uuid REFERENCES catalog.vendors(id) ON DELETE SET NULL,
  sell_price_usd    numeric NOT NULL,
  cost_lak          numeric NOT NULL DEFAULT 0,
  materials_cost_lak numeric DEFAULT 0,
  margin_pct        numeric GENERATED ALWAYS AS (
    CASE WHEN sell_price_usd > 0 THEN (sell_price_usd - (cost_lak + materials_cost_lak)/20850.0) / sell_price_usd * 100 ELSE 0 END
  ) STORED,
  description       text,
  description_long_md text,
  photo_urls        text[] DEFAULT '{}',
  usali_category    text DEFAULT 'Other Operated',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_catalog_workshops_updated_at BEFORE UPDATE ON catalog.workshops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Cloudbeds bridge view (read-only)
CREATE OR REPLACE VIEW catalog.v_rooms_compilable AS
  SELECT
    room_type_id,
    room_type_name,
    base_rate_usd,
    available_count,
    max_occupancy,
    photos,
    'cloudbeds' AS source
  FROM public.rate_inventory
  WHERE date >= CURRENT_DATE
    AND COALESCE(is_stop_sell, false) = false;

-- ---------------------------------------------------------------------
-- 4. PRICING
-- ---------------------------------------------------------------------

CREATE TABLE pricing.pricelist (
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
CREATE TRIGGER set_pricing_pricelist_updated_at BEFORE UPDATE ON pricing.pricelist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_pricing_pricelist_sku_valid ON pricing.pricelist(sku, valid_from);
CREATE INDEX idx_pricing_pricelist_tier ON pricing.pricelist USING gin(tier_visibility);
CREATE INDEX idx_pricing_pricelist_active ON pricing.pricelist(is_active, valid_from) WHERE is_active = true;

CREATE TABLE pricing.seasons (
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
CREATE TRIGGER set_pricing_seasons_updated_at BEFORE UPDATE ON pricing.seasons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_pricing_seasons_window ON pricing.seasons(property_id, date_from, date_to);

CREATE TABLE pricing.fx_locks (
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
CREATE INDEX idx_pricing_fx_until ON pricing.fx_locks(locked_until DESC);

CREATE TABLE pricing.margin_overrides (
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

-- ---------------------------------------------------------------------
-- 5. COMPILER
-- ---------------------------------------------------------------------

CREATE TABLE compiler.runs (
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
CREATE TRIGGER set_compiler_runs_updated_at BEFORE UPDATE ON compiler.runs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_compiler_runs_operator ON compiler.runs(operator_id, created_at DESC);
CREATE INDEX idx_compiler_runs_status ON compiler.runs(status, created_at DESC);

CREATE TABLE compiler.variants (
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
CREATE TRIGGER set_compiler_variants_updated_at BEFORE UPDATE ON compiler.variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_compiler_variants_run ON compiler.variants(run_id);

CREATE TABLE compiler.itinerary_templates (
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
CREATE TRIGGER set_compiler_itinerary_updated_at BEFORE UPDATE ON compiler.itinerary_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE compiler.deploys (
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
CREATE TRIGGER set_compiler_deploys_updated_at BEFORE UPDATE ON compiler.deploys
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_compiler_deploys_subdomain ON compiler.deploys(subdomain);
CREATE INDEX idx_compiler_deploys_status ON compiler.deploys(status) WHERE status IN ('queued','provisioning');

-- ---------------------------------------------------------------------
-- 6. WEB
-- ---------------------------------------------------------------------

CREATE TABLE web.sites (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  domain            text NOT NULL UNIQUE,
  property_id       text NOT NULL DEFAULT 'namkhan',
  site_type         text NOT NULL CHECK (site_type IN ('root','retreat','series','campaign','landing')),
  parent_site_id    uuid REFERENCES web.sites(id) ON DELETE SET NULL,
  theme_pack        text NOT NULL DEFAULT 'namkhan',
  brand_tokens      jsonb DEFAULT '{}',
  default_seo_jsonb jsonb DEFAULT '{}',
  favicon_url       text,
  og_image_url      text,
  ga4_id            text,
  meta_pixel_id     text,
  klaviyo_account_id text,
  is_active         boolean NOT NULL DEFAULT true,
  deployed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_web_sites_updated_at BEFORE UPDATE ON web.sites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_web_sites_active ON web.sites(is_active) WHERE is_active = true;

CREATE TABLE web.pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid NOT NULL REFERENCES web.sites(id) ON DELETE CASCADE,
  slug              text NOT NULL,
  full_path         text NOT NULL,
  page_type         text NOT NULL CHECK (page_type IN ('home','retreat','series','post','campaign_landing','legal','about','contact','press','faq','sitemap')),
  title             text NOT NULL,
  h1                text,
  meta_description  text,
  hero_jsonb        jsonb,
  body_md           text,
  modules_jsonb     jsonb DEFAULT '[]',
  seo_jsonb         jsonb DEFAULT '{}',
  og_jsonb          jsonb DEFAULT '{}',
  schema_org_jsonb  jsonb,
  canonical_url     text,
  status            text NOT NULL CHECK (status IN ('draft','review','live','archived')) DEFAULT 'draft',
  published_at      timestamptz,
  scheduled_for     timestamptz,
  expires_at        timestamptz,
  ab_test_id        uuid,
  ab_variant        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, full_path)
);
CREATE TRIGGER set_web_pages_updated_at BEFORE UPDATE ON web.pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_web_pages_site_path ON web.pages(site_id, full_path);
CREATE INDEX idx_web_pages_live ON web.pages(site_id, page_type) WHERE status = 'live';

CREATE TABLE web.retreats (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES compiler.runs(id) ON DELETE RESTRICT,
  variant_id        uuid NOT NULL REFERENCES compiler.variants(id) ON DELETE RESTRICT,
  site_id           uuid REFERENCES web.sites(id) ON DELETE SET NULL,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  tagline           text,
  arrival_window_from date NOT NULL,
  arrival_window_to   date NOT NULL,
  spots_total       int NOT NULL,
  spots_booked      int NOT NULL DEFAULT 0,
  spots_remaining   int GENERATED ALWAYS AS (spots_total - spots_booked) STORED,
  price_usd_from    numeric NOT NULL,
  series_slug       text REFERENCES content.series(slug) ON DELETE SET NULL,
  hero_asset_id     uuid,
  gallery_asset_ids uuid[],
  status            text NOT NULL CHECK (status IN ('draft','published','sold_out','expired','cancelled')) DEFAULT 'draft',
  seo_jsonb         jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK(arrival_window_to >= arrival_window_from)
);
CREATE TRIGGER set_web_retreats_updated_at BEFORE UPDATE ON web.retreats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_web_retreats_status ON web.retreats(status, arrival_window_from);
CREATE INDEX idx_web_retreats_series ON web.retreats(series_slug);

CREATE TABLE web.retreats_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id        uuid NOT NULL REFERENCES web.retreats(id) ON DELETE CASCADE,
  run_id            uuid NOT NULL REFERENCES compiler.runs(id) ON DELETE RESTRICT,
  version           int NOT NULL,
  parent_version_id uuid REFERENCES web.retreats_versions(id) ON DELETE SET NULL,
  superseded_at     timestamptz,
  supersedes_url_redirect boolean DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(retreat_id, version)
);

CREATE TABLE web.series (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE REFERENCES content.series(slug) ON DELETE CASCADE,
  site_id           uuid REFERENCES web.sites(id) ON DELETE SET NULL,
  hub_page_id       uuid REFERENCES web.pages(id) ON DELETE SET NULL,
  total_retreats_run int NOT NULL DEFAULT 0,
  total_alumni      int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_web_series_updated_at BEFORE UPDATE ON web.series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE web.posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid NOT NULL REFERENCES web.sites(id) ON DELETE CASCADE,
  slug              text NOT NULL,
  title             text NOT NULL,
  author_name       text,
  author_avatar_url text,
  excerpt           text,
  body_md           text,
  hero_asset_id     uuid,
  series_slug       text REFERENCES content.series(slug) ON DELETE SET NULL,
  related_retreat_ids uuid[],
  tags              text[] DEFAULT '{}',
  reading_time_min  int,
  status            text NOT NULL CHECK (status IN ('draft','review','live','archived')) DEFAULT 'draft',
  published_at      timestamptz,
  klaviyo_synced_at timestamptz,
  seo_jsonb         jsonb DEFAULT '{}',
  og_jsonb          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, slug)
);
CREATE TRIGGER set_web_posts_updated_at BEFORE UPDATE ON web.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_web_posts_live ON web.posts(site_id, published_at DESC) WHERE status = 'live';
CREATE INDEX idx_web_posts_series ON web.posts(series_slug);
CREATE INDEX idx_web_posts_tags ON web.posts USING gin(tags);

CREATE TABLE web.campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  campaign_type     text NOT NULL CHECK (campaign_type IN ('launch','nurture','reactivation','seasonal','evergreen','ad')),
  channel           text NOT NULL CHECK (channel IN ('email','paid_search','paid_social','organic','referral','direct')),
  target_audience_jsonb jsonb DEFAULT '{}',
  goal              text NOT NULL CHECK (goal IN ('lead','booking','nps','revenue')),
  goal_target       int,
  goal_value_usd    numeric,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content_default text,
  utm_term_default  text,
  budget_usd        numeric,
  spent_usd         numeric DEFAULT 0,
  starts_at         timestamptz,
  ends_at           timestamptz,
  linked_retreat_id uuid REFERENCES web.retreats(id) ON DELETE SET NULL,
  linked_series_slug text REFERENCES content.series(slug) ON DELETE SET NULL,
  klaviyo_flow_id   text,
  meta_campaign_id  text,
  google_ads_campaign_id text,
  status            text NOT NULL CHECK (status IN ('draft','scheduled','live','paused','completed')) DEFAULT 'draft',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_web_campaigns_updated_at BEFORE UPDATE ON web.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_web_campaigns_status ON web.campaigns(status, starts_at);

CREATE TABLE web.campaign_pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid NOT NULL REFERENCES web.campaigns(id) ON DELETE CASCADE,
  page_id           uuid NOT NULL REFERENCES web.pages(id) ON DELETE CASCADE,
  variant           text NOT NULL CHECK (variant IN ('A','B','C')),
  traffic_split_pct int NOT NULL DEFAULT 33,
  visits            int NOT NULL DEFAULT 0,
  conversions       int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, variant)
);
CREATE TRIGGER set_web_campaign_pages_updated_at BEFORE UPDATE ON web.campaign_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE web.ab_tests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  hypothesis        text,
  page_id           uuid REFERENCES web.pages(id) ON DELETE CASCADE,
  metric            text NOT NULL,
  started_at        timestamptz,
  ended_at          timestamptz,
  winner_variant    text,
  statistical_significance numeric,
  status            text NOT NULL CHECK (status IN ('running','stopped','inconclusive','winner_chosen')) DEFAULT 'running',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_web_ab_tests_updated_at BEFORE UPDATE ON web.ab_tests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE web.subscribers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE,
  first_name        text,
  last_name         text,
  phone             text,
  country           text,
  source_page_id    uuid REFERENCES web.pages(id) ON DELETE SET NULL,
  source_campaign_id uuid REFERENCES web.campaigns(id) ON DELETE SET NULL,
  utm_jsonb         jsonb DEFAULT '{}',
  lifecycle_stage   text NOT NULL CHECK (lifecycle_stage IN ('new','engaged','qualified','customer','alumni','churned','unsubscribed')) DEFAULT 'new',
  interest_series   text[] DEFAULT '{}',
  language          text NOT NULL DEFAULT 'en',
  klaviyo_id        text,
  klaviyo_synced_at timestamptz,
  last_email_open_at timestamptz,
  last_email_click_at timestamptz,
  booking_count     int NOT NULL DEFAULT 0,
  ltv_usd           numeric NOT NULL DEFAULT 0,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_web_subscribers_updated_at BEFORE UPDATE ON web.subscribers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_web_subscribers_lifecycle ON web.subscribers(lifecycle_stage, last_email_open_at DESC);
CREATE INDEX idx_web_subscribers_interest ON web.subscribers USING gin(interest_series);

CREATE TABLE web.consents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id     uuid NOT NULL REFERENCES web.subscribers(id) ON DELETE CASCADE,
  consent_type      text NOT NULL CHECK (consent_type IN ('marketing','analytics','cookies','whatsapp','sms')),
  granted           boolean NOT NULL,
  granted_at        timestamptz,
  revoked_at        timestamptz,
  ip_hash           text,
  user_agent        text,
  page_id           uuid REFERENCES web.pages(id) ON DELETE SET NULL,
  double_opt_in_token text UNIQUE,
  double_opt_in_confirmed_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_web_consents_sub ON web.consents(subscriber_id);

CREATE TABLE web.email_sends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid REFERENCES web.campaigns(id) ON DELETE SET NULL,
  subscriber_id     uuid NOT NULL REFERENCES web.subscribers(id) ON DELETE CASCADE,
  klaviyo_message_id text,
  sent_at           timestamptz,
  delivered_at      timestamptz,
  opened_at         timestamptz,
  clicked_at        timestamptz,
  bounced_at        timestamptz,
  unsubscribed_at   timestamptz,
  revenue_attributed_usd numeric NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_web_email_sends_sub ON web.email_sends(subscriber_id, sent_at DESC);

CREATE TABLE web.events (
  id                bigserial PRIMARY KEY,
  session_id        text,
  subscriber_id     uuid REFERENCES web.subscribers(id) ON DELETE SET NULL,
  event_type        text NOT NULL CHECK (event_type IN ('page_view','lead_capture','cta_click','video_play','scroll_depth','booking_start','booking_complete','configure_quote','configure_save','campaign_landing')),
  page_id           uuid REFERENCES web.pages(id) ON DELETE SET NULL,
  retreat_id        uuid REFERENCES web.retreats(id) ON DELETE SET NULL,
  campaign_id       uuid REFERENCES web.campaigns(id) ON DELETE SET NULL,
  ip_hash           text,
  country           text,
  device            text,
  referrer_url      text,
  value_usd         numeric,
  properties_jsonb  jsonb,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_web_events_occurred ON web.events(occurred_at DESC);
CREATE INDEX idx_web_events_type ON web.events(event_type, occurred_at DESC);
CREATE INDEX idx_web_events_session ON web.events(session_id, occurred_at);

CREATE TABLE web.pages_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id           uuid NOT NULL REFERENCES web.pages(id) ON DELETE CASCADE,
  edited_by         uuid,
  field_path        text NOT NULL,
  value_before      jsonb,
  value_after       jsonb,
  edit_type         text NOT NULL CHECK (edit_type IN ('live','compile','rollback')),
  reverted_from_id  uuid REFERENCES web.pages_history(id) ON DELETE SET NULL,
  edited_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_web_pages_history_page ON web.pages_history(page_id, edited_at DESC);

CREATE TABLE web.configurations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id        uuid NOT NULL REFERENCES web.retreats(id) ON DELETE CASCADE,
  share_token       text NOT NULL UNIQUE,
  config_jsonb      jsonb NOT NULL,
  total_usd         numeric NOT NULL,
  created_by_email  text,
  ip_hash           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  converted_to_booking_id uuid
);
CREATE INDEX idx_web_configurations_token ON web.configurations(share_token);
CREATE INDEX idx_web_configurations_retreat ON web.configurations(retreat_id);

-- ---------------------------------------------------------------------
-- 7. BOOK
-- ---------------------------------------------------------------------

CREATE TABLE book.bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_slug      text NOT NULL,
  variant_id        uuid REFERENCES compiler.variants(id) ON DELETE SET NULL,
  public_token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  guest_first_name  text NOT NULL,
  guest_last_name   text NOT NULL,
  guest_email       text NOT NULL,
  guest_phone       text,
  guest_country     text,
  party_size        int NOT NULL,
  arrival_date      date NOT NULL,
  departure_date    date NOT NULL,
  nights            int GENERATED ALWAYS AS ((departure_date - arrival_date)::int) STORED,
  config_jsonb      jsonb NOT NULL DEFAULT '{}',
  config_total_usd  numeric,
  config_source     text CHECK (config_source IN ('default','guest_custom','operator_preload')) DEFAULT 'default',
  config_share_token text UNIQUE,
  add_ons_jsonb     jsonb DEFAULT '[]',
  special_requests  text,
  total_usd         numeric NOT NULL,
  deposit_usd       numeric NOT NULL,
  balance_usd       numeric NOT NULL,
  deposit_paid_usd  numeric NOT NULL DEFAULT 0,
  balance_paid_usd  numeric NOT NULL DEFAULT 0,
  balance_due_date  date,
  fx_rate_at_book   numeric,
  fx_lock_id        uuid REFERENCES pricing.fx_locks(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_session_id text,
  cloudbeds_reservation_id text,
  status            text NOT NULL CHECK (status IN ('held','confirmed','deposit_paid','paid_full','cancelled','refunded','no_show')) DEFAULT 'held',
  cancellation_reason text,
  cancelled_at      timestamptz,
  source_campaign_id uuid REFERENCES web.campaigns(id) ON DELETE SET NULL,
  referrer_url      text,
  utm_jsonb         jsonb DEFAULT '{}',
  ip_hash           text,
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK(departure_date >= arrival_date),
  CHECK(party_size > 0)
);
CREATE TRIGGER set_book_bookings_updated_at BEFORE UPDATE ON book.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_book_bookings_token ON book.bookings(public_token);
CREATE INDEX idx_book_bookings_email ON book.bookings(guest_email, status);
CREATE INDEX idx_book_bookings_status ON book.bookings(status, arrival_date);
CREATE INDEX idx_book_bookings_retreat ON book.bookings(retreat_slug, arrival_date);

CREATE TABLE book.payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid NOT NULL REFERENCES book.bookings(id) ON DELETE RESTRICT,
  stripe_event_id   text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  amount_usd        numeric NOT NULL,
  fee_usd           numeric DEFAULT 0,
  net_usd           numeric,
  payment_type      text NOT NULL CHECK (payment_type IN ('deposit','balance','addon','refund')),
  status            text NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  scheduled_for     timestamptz,
  processed_at      timestamptz,
  raw_payload       jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_book_payments_booking ON book.payments(booking_id);
CREATE INDEX idx_book_payments_scheduled ON book.payments(scheduled_for) WHERE status = 'pending';

CREATE TABLE book.cancellations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid NOT NULL REFERENCES book.bookings(id) ON DELETE CASCADE,
  cancelled_by      text NOT NULL CHECK (cancelled_by IN ('guest','host','system')),
  days_before_arrival int,
  refund_pct        int,
  refund_amount_usd numeric,
  reason_code       text,
  reason_notes      text,
  processed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE book.reconcile_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid REFERENCES book.bookings(id) ON DELETE SET NULL,
  alert_type        text NOT NULL CHECK (alert_type IN ('cb_missing','cb_mismatch','stripe_missing','total_mismatch','date_mismatch')),
  details_jsonb     jsonb,
  resolved_at       timestamptz,
  resolved_by       uuid,
  resolution_notes  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_book_reconcile_open ON book.reconcile_alerts(created_at DESC) WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------
-- 8. SECURITY DEFINER RPCs (anon mutations)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION web.capture_lead(
  p_email text, p_first_name text DEFAULT NULL, p_country text DEFAULT NULL,
  p_source_page_id uuid DEFAULT NULL, p_consents text[] DEFAULT ARRAY['marketing']::text[],
  p_ip_hash text DEFAULT NULL, p_user_agent text DEFAULT NULL,
  p_utm jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_subscriber_id uuid;
  v_token text;
  v_eu boolean := p_country = ANY (ARRAY['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
BEGIN
  INSERT INTO web.subscribers (email, first_name, country, source_page_id, utm_jsonb, lifecycle_stage)
  VALUES (lower(p_email), p_first_name, p_country, p_source_page_id, p_utm, 'new')
  ON CONFLICT (email) DO UPDATE SET
    first_name = COALESCE(web.subscribers.first_name, EXCLUDED.first_name),
    country    = COALESCE(web.subscribers.country, EXCLUDED.country),
    updated_at = now()
  RETURNING id INTO v_subscriber_id;

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO web.consents (subscriber_id, consent_type, granted, granted_at, ip_hash, user_agent, page_id, double_opt_in_token)
  SELECT v_subscriber_id, ct, true, now(), p_ip_hash, p_user_agent, p_source_page_id,
         CASE WHEN v_eu THEN v_token ELSE NULL END
  FROM unnest(p_consents) AS ct;

  RETURN jsonb_build_object(
    'subscriber_id', v_subscriber_id,
    'opt_in_required', v_eu,
    'double_opt_in_token', CASE WHEN v_eu THEN v_token ELSE NULL END
  );
END $$;

CREATE OR REPLACE FUNCTION web.track_event(
  p_session_id text, p_event_type text,
  p_page_id uuid DEFAULT NULL, p_retreat_id uuid DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL, p_value_usd numeric DEFAULT NULL,
  p_properties jsonb DEFAULT '{}',
  p_ip_hash text DEFAULT NULL, p_country text DEFAULT NULL,
  p_device text DEFAULT NULL, p_referrer text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO web.events (session_id, event_type, page_id, retreat_id, campaign_id, value_usd, properties_jsonb, ip_hash, country, device, referrer_url)
  VALUES (p_session_id, p_event_type, p_page_id, p_retreat_id, p_campaign_id, p_value_usd, p_properties, p_ip_hash, p_country, p_device, p_referrer)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------
-- 9. RLS — enable on every new table
-- ---------------------------------------------------------------------

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('catalog','pricing','compiler','book','web','content')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 9.1 catalog.* — authenticated read; service-role write
CREATE POLICY catalog_authenticated_select ON catalog.vendors          FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.vendor_rate_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.activities       FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.spa_treatments   FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.fnb_items        FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.fnb_menus        FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.transport_options FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.addons           FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.ceremonies       FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_authenticated_select ON catalog.workshops        FOR SELECT TO authenticated USING (true);

-- 9.2 pricing.* — authenticated read
CREATE POLICY pricing_authenticated_select ON pricing.pricelist        FOR SELECT TO authenticated USING (true);
CREATE POLICY pricing_authenticated_select ON pricing.seasons          FOR SELECT TO authenticated USING (true);
CREATE POLICY pricing_authenticated_select ON pricing.fx_locks         FOR SELECT TO authenticated USING (true);
CREATE POLICY pricing_authenticated_select ON pricing.margin_overrides FOR SELECT TO authenticated USING (true);

-- 9.3 compiler.* — authenticated read (own runs); service-role write
CREATE POLICY compiler_authenticated_select_own ON compiler.runs       FOR SELECT TO authenticated
  USING (operator_id = auth.uid() OR auth.role() = 'service_role');
CREATE POLICY compiler_authenticated_select ON compiler.variants       FOR SELECT TO authenticated USING (true);
CREATE POLICY compiler_authenticated_select ON compiler.itinerary_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY compiler_authenticated_select ON compiler.deploys        FOR SELECT TO authenticated USING (true);

-- 9.4 book.* — public token access for guests; authenticated all
CREATE POLICY book_anon_by_token ON book.bookings FOR SELECT TO anon
  USING (public_token = current_setting('request.jwt.claim.public_token', true));
CREATE POLICY book_authenticated_select ON book.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY book_authenticated_select ON book.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY book_authenticated_select ON book.cancellations FOR SELECT TO authenticated USING (true);
CREATE POLICY book_authenticated_select ON book.reconcile_alerts FOR SELECT TO authenticated USING (true);

-- 9.5 web.* — public read live content; authenticated full
CREATE POLICY web_sites_anon_active ON web.sites FOR SELECT TO anon USING (is_active = true);
CREATE POLICY web_sites_authenticated ON web.sites FOR SELECT TO authenticated USING (true);

CREATE POLICY web_pages_anon_live ON web.pages FOR SELECT TO anon USING (status = 'live');
CREATE POLICY web_pages_authenticated ON web.pages FOR SELECT TO authenticated USING (true);

CREATE POLICY web_retreats_anon_published ON web.retreats FOR SELECT TO anon USING (status IN ('published','sold_out'));
CREATE POLICY web_retreats_authenticated ON web.retreats FOR SELECT TO authenticated USING (true);

CREATE POLICY web_posts_anon_live ON web.posts FOR SELECT TO anon USING (status = 'live');
CREATE POLICY web_posts_authenticated ON web.posts FOR SELECT TO authenticated USING (true);

CREATE POLICY web_series_anon ON web.series FOR SELECT TO anon USING (true);
CREATE POLICY web_series_authenticated ON web.series FOR SELECT TO authenticated USING (true);

CREATE POLICY web_authenticated_select ON web.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.campaign_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.ab_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.subscribers FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.consents FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.email_sends FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.events FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.pages_history FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.retreats_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY web_authenticated_select ON web.configurations FOR SELECT TO authenticated USING (true);

-- 9.6 content.* — public read all (reference data)
CREATE POLICY content_anon_select ON content.series FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY content_anon_select ON content.lunar_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY content_anon_select ON content.usali_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY content_anon_select ON content.legal_pages FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------
-- 10. Privileges + PostgREST exposure
-- ---------------------------------------------------------------------

GRANT USAGE ON SCHEMA catalog, pricing, compiler, book, web, content
  TO anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA content TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog, pricing, compiler, web, book TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalog, pricing, compiler, web, book, content TO service_role;

GRANT EXECUTE ON FUNCTION web.capture_lead(text,text,text,uuid,text[],text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION web.track_event(text,text,uuid,uuid,uuid,numeric,jsonb,text,text,text,text) TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA catalog, pricing, compiler, web, book GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA content GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog, pricing, compiler, web, book, content GRANT INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- Merge schemas into PostgREST exposure (don't overwrite)
DO $$
DECLARE
  v_current text;
  v_new text;
  v_target text[] := ARRAY['public','graphql_public','marketing','guest','gl','catalog','pricing','compiler','book','web','content'];
  v_s text;
BEGIN
  SELECT array_to_string(setconfig, ' | ') INTO v_current
  FROM pg_db_role_setting drs
  JOIN pg_roles r ON r.oid = drs.setrole
  WHERE r.rolname = 'authenticator';

  v_new := array_to_string(v_target, ', ');
  EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas TO %L', v_new);
  PERFORM pg_notify('pgrst', 'reload config');
  RAISE NOTICE 'pgrst.db_schemas set to: %', v_new;
END $$;

COMMIT;

-- =====================================================================
-- End of forward migration. Apply seed next: ..._seed.sql
-- =====================================================================
