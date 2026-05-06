-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504213009
-- Name:    retreat_compiler_catalog_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS catalog.vendors (
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
DROP TRIGGER IF EXISTS set_catalog_vendors_updated_at ON catalog.vendors;
CREATE TRIGGER set_catalog_vendors_updated_at BEFORE UPDATE ON catalog.vendors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_catalog_vendors_active ON catalog.vendors(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS catalog.vendor_rate_cards (
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

CREATE TABLE IF NOT EXISTS catalog.activities (
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
DROP TRIGGER IF EXISTS set_catalog_activities_updated_at ON catalog.activities;
CREATE TRIGGER set_catalog_activities_updated_at BEFORE UPDATE ON catalog.activities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_catalog_activities_series_tags ON catalog.activities USING gin(series_tags);
CREATE INDEX IF NOT EXISTS idx_catalog_activities_seasonality ON catalog.activities USING gin(seasonality);
CREATE INDEX IF NOT EXISTS idx_catalog_activities_lunar ON catalog.activities(lunar_dependent) WHERE lunar_dependent = true;
CREATE INDEX IF NOT EXISTS idx_catalog_activities_active ON catalog.activities(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS catalog.spa_treatments (
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
DROP TRIGGER IF EXISTS set_catalog_spa_updated_at ON catalog.spa_treatments;
CREATE TRIGGER set_catalog_spa_updated_at BEFORE UPDATE ON catalog.spa_treatments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS catalog.fnb_items (
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
DROP TRIGGER IF EXISTS set_catalog_fnb_items_updated_at ON catalog.fnb_items;
CREATE TRIGGER set_catalog_fnb_items_updated_at BEFORE UPDATE ON catalog.fnb_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_catalog_fnb_dietary ON catalog.fnb_items USING gin(dietary_tags);

CREATE TABLE IF NOT EXISTS catalog.fnb_menus (
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
DROP TRIGGER IF EXISTS set_catalog_fnb_menus_updated_at ON catalog.fnb_menus;
CREATE TRIGGER set_catalog_fnb_menus_updated_at BEFORE UPDATE ON catalog.fnb_menus
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS catalog.transport_options (
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
DROP TRIGGER IF EXISTS set_catalog_transport_updated_at ON catalog.transport_options;
CREATE TRIGGER set_catalog_transport_updated_at BEFORE UPDATE ON catalog.transport_options
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS catalog.addons (
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
DROP TRIGGER IF EXISTS set_catalog_addons_updated_at ON catalog.addons;
CREATE TRIGGER set_catalog_addons_updated_at BEFORE UPDATE ON catalog.addons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS catalog.ceremonies (
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
DROP TRIGGER IF EXISTS set_catalog_ceremonies_updated_at ON catalog.ceremonies;
CREATE TRIGGER set_catalog_ceremonies_updated_at BEFORE UPDATE ON catalog.ceremonies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS catalog.workshops (
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
DROP TRIGGER IF EXISTS set_catalog_workshops_updated_at ON catalog.workshops;
CREATE TRIGGER set_catalog_workshops_updated_at BEFORE UPDATE ON catalog.workshops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Cloudbeds bridge view (PATCHED to use real public.rate_inventory columns)
CREATE OR REPLACE VIEW catalog.v_rooms_compilable AS
  SELECT
    room_type_id,
    NULL::text AS room_type_name,
    rate AS base_rate_usd,
    available_rooms AS available_count,
    NULL::int AS max_occupancy,
    NULL::text[] AS photos,
    inventory_date AS date,
    'cloudbeds'::text AS source
  FROM public.rate_inventory
  WHERE inventory_date >= CURRENT_DATE
    AND COALESCE(stop_sell, false) = false;