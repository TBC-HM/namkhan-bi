-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429210634
-- Name:    phase1_04_fb_spa_activities
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.4 — `fb`, `spa`, `activities` schemas
-- Operational metadata only. Revenue stays in public.transactions.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS fb;
CREATE SCHEMA IF NOT EXISTS spa;
CREATE SCHEMA IF NOT EXISTS activities;
COMMENT ON SCHEMA fb IS 'F&B / Roots Restaurant operational metadata: outlets, recipes, allergens, wastage, food cost';
COMMENT ON SCHEMA spa IS 'Spa / Jungle Spa: treatments, protocols, therapists, schedule, consumables';
COMMENT ON SCHEMA activities IS 'Activities & experiences: catalog, schedules, bookings, guides, equipment';

-- =====================================================================
-- F&B
-- =====================================================================

CREATE TABLE IF NOT EXISTS fb.outlets (
  outlet_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    bigint REFERENCES public.hotels(property_id),
  code           text UNIQUE NOT NULL,
  name           text NOT NULL,
  outlet_type    text,                                 -- restaurant | bar | room_service | breakfast | event
  seats          int,
  meal_periods   text[] DEFAULT '{}'::text[],          -- breakfast | lunch | dinner | bar
  is_active      boolean DEFAULT true,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

INSERT INTO fb.outlets (property_id, code, name, outlet_type, meal_periods) VALUES
  (260955,'roots',         'Roots Restaurant', 'restaurant',  ARRAY['lunch','dinner']),
  (260955,'breakfast',     'Breakfast',        'breakfast',   ARRAY['breakfast']),
  (260955,'bar',           'Bar',              'bar',         ARRAY['bar']),
  (260955,'room_service',  'Room Service',     'room_service',ARRAY['breakfast','lunch','dinner','bar'])
ON CONFLICT (code) DO NOTHING;

-- Allergen master
CREATE TABLE IF NOT EXISTS fb.allergens (
  code        text PRIMARY KEY,                        -- gluten | dairy | nuts | shellfish | egg | soy | sesame | mustard | fish | celery | sulphites | molluscs | lupin
  name        text NOT NULL,
  name_lo     text,
  severity_default text DEFAULT 'moderate',
  notes       text
);
INSERT INTO fb.allergens (code, name) VALUES
  ('gluten','Gluten'),('dairy','Dairy'),('nuts','Nuts'),('peanuts','Peanuts'),
  ('shellfish','Shellfish'),('fish','Fish'),('egg','Egg'),('soy','Soy'),
  ('sesame','Sesame'),('mustard','Mustard'),('celery','Celery'),
  ('sulphites','Sulphites'),('molluscs','Molluscs'),('lupin','Lupin')
ON CONFLICT (code) DO NOTHING;

-- Recipes link to public.items.item_id (Cloudbeds source of truth for menu items)
CREATE TABLE IF NOT EXISTS fb.recipes (
  recipe_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      bigint REFERENCES public.hotels(property_id),
  item_id          text REFERENCES public.items(item_id),
  outlet_id        uuid REFERENCES fb.outlets(outlet_id),
  name             text NOT NULL,
  description      text,
  yield_qty        numeric DEFAULT 1,
  yield_unit       text DEFAULT 'portion',
  prep_time_min    int,
  cook_time_min    int,
  station          text,                                -- cold | hot | grill | pastry | bar
  difficulty       text,
  current_cost     numeric,
  current_cost_currency text DEFAULT 'LAK',
  cost_pct         numeric,                             -- cost / sell price
  selling_price    numeric,
  is_active        boolean DEFAULT true,
  body_markdown    text,                                -- the full recipe text
  photo_media_id   uuid REFERENCES app.media(media_id),
  source_doc_id    uuid REFERENCES docs.documents(doc_id),
  raw              jsonb DEFAULT '{}'::jsonb,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipes_item ON fb.recipes(item_id);

CREATE TABLE IF NOT EXISTS fb.recipe_ingredients (
  id                bigserial PRIMARY KEY,
  recipe_id         uuid NOT NULL REFERENCES fb.recipes(recipe_id) ON DELETE CASCADE,
  ingredient_name   text NOT NULL,
  quantity          numeric,
  unit              text,
  unit_cost         numeric,
  unit_cost_currency text DEFAULT 'LAK',
  vendor_id         uuid REFERENCES ops.vendors(vendor_id),
  is_optional       boolean DEFAULT false,
  notes             text
);
CREATE INDEX IF NOT EXISTS idx_recipe_ing_recipe ON fb.recipe_ingredients(recipe_id);

CREATE TABLE IF NOT EXISTS fb.menu_item_allergens (
  item_id      text NOT NULL REFERENCES public.items(item_id) ON DELETE CASCADE,
  allergen     text NOT NULL REFERENCES fb.allergens(code),
  is_contains  boolean DEFAULT true,                    -- false = "may contain"
  notes        text,
  PRIMARY KEY (item_id, allergen)
);

CREATE TABLE IF NOT EXISTS fb.wastage_log (
  id              bigserial PRIMARY KEY,
  property_id     bigint REFERENCES public.hotels(property_id),
  outlet_id       uuid REFERENCES fb.outlets(outlet_id),
  occurred_on     date NOT NULL,
  ingredient_name text,
  item_id         text REFERENCES public.items(item_id),
  quantity        numeric,
  unit            text,
  cost_value      numeric,
  cost_currency   text DEFAULT 'LAK',
  reason          text,                                  -- spoilage | over_prep | dropped | training | other
  reported_by     uuid REFERENCES auth.users(id),
  notes           text,
  evidence_doc_id uuid REFERENCES docs.documents(doc_id),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wastage_date ON fb.wastage_log(occurred_on DESC);

CREATE TABLE IF NOT EXISTS fb.food_cost_snapshots (
  id              bigserial PRIMARY KEY,
  property_id     bigint REFERENCES public.hotels(property_id),
  outlet_id       uuid REFERENCES fb.outlets(outlet_id),
  snapshot_date   date NOT NULL,
  period_start    date,
  period_end      date,
  food_revenue    numeric,
  food_cost       numeric,
  food_cost_pct   numeric,
  beverage_revenue numeric,
  beverage_cost   numeric,
  beverage_cost_pct numeric,
  wastage_value   numeric,
  wastage_pct     numeric,
  target_food_pct numeric,
  notes           text,
  raw             jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

-- =====================================================================
-- SPA
-- =====================================================================

CREATE TABLE IF NOT EXISTS spa.treatments (
  treatment_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       bigint REFERENCES public.hotels(property_id),
  item_id           text REFERENCES public.items(item_id),    -- Cloudbeds revenue link
  code              text,
  name              text NOT NULL,
  category          text,                                     -- massage | facial | body | ritual | wellness | hair
  duration_min      int,
  list_price        numeric,
  list_price_currency text DEFAULT 'USD',
  protocol_doc_id   uuid REFERENCES docs.documents(doc_id),
  description       text,
  benefits          text,
  contraindications text,
  is_active         boolean DEFAULT true,
  raw               jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spa.therapists (
  therapist_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      bigint REFERENCES public.hotels(property_id),
  user_id          uuid REFERENCES auth.users(id),
  certifications   text[],
  specialties      text[],
  languages        text[],
  rating           numeric,
  is_active        boolean DEFAULT true,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spa.therapist_treatments (
  therapist_id  uuid REFERENCES spa.therapists(therapist_id) ON DELETE CASCADE,
  treatment_id  uuid REFERENCES spa.treatments(treatment_id) ON DELETE CASCADE,
  PRIMARY KEY (therapist_id, treatment_id)
);

CREATE TABLE IF NOT EXISTS spa.treatment_bookings (
  booking_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       bigint REFERENCES public.hotels(property_id),
  treatment_id      uuid REFERENCES spa.treatments(treatment_id),
  therapist_id      uuid REFERENCES spa.therapists(therapist_id),
  reservation_id    text REFERENCES public.reservations(reservation_id),
  guest_id          text REFERENCES public.guests(guest_id),
  guest_name        text,
  scheduled_at      timestamptz NOT NULL,
  duration_min      int,
  room              text,
  status            text DEFAULT 'booked' CHECK (status IN ('booked','confirmed','in_progress','completed','no_show','cancelled')),
  price             numeric,
  currency          text,
  posted_to_folio   boolean DEFAULT false,
  cloudbeds_charge_id text,
  notes             text,
  raw               jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spa_book_date ON spa.treatment_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_spa_book_res ON spa.treatment_bookings(reservation_id);

CREATE TABLE IF NOT EXISTS spa.consumables (
  id            bigserial PRIMARY KEY,
  property_id   bigint REFERENCES public.hotels(property_id),
  name          text NOT NULL,
  category      text,                                  -- oil | linen | candle | scrub | retail
  unit          text,
  current_stock numeric,
  reorder_point numeric,
  unit_cost     numeric,
  unit_cost_currency text DEFAULT 'USD',
  vendor_id     uuid REFERENCES ops.vendors(vendor_id),
  notes         text,
  updated_at    timestamptz DEFAULT now()
);

-- =====================================================================
-- ACTIVITIES
-- =====================================================================

CREATE TABLE IF NOT EXISTS activities.catalog (
  activity_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint REFERENCES public.hotels(property_id),
  item_id         text REFERENCES public.items(item_id),
  code            text,
  name            text NOT NULL,
  category        text,                                 -- river | cultural | wellness | excursion | culinary | wildlife
  duration_min    int,
  capacity_min    int DEFAULT 1,
  capacity_max    int,
  difficulty      text,
  list_price      numeric,
  list_price_currency text DEFAULT 'USD',
  per_unit        text DEFAULT 'per_person',
  is_external     boolean DEFAULT false,                -- run by partner
  partner_id      uuid,                                  -- soft FK below
  description     text,
  inclusions      text,
  exclusions      text,
  meeting_point   text,
  start_times     text[],
  cover_media_id  uuid REFERENCES app.media(media_id),
  source_doc_id   uuid REFERENCES docs.documents(doc_id),
  is_active       boolean DEFAULT true,
  raw             jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities.guides (
  guide_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint REFERENCES public.hotels(property_id),
  user_id       uuid REFERENCES auth.users(id),
  name          text NOT NULL,
  certifications text[],
  languages     text[],
  is_external   boolean DEFAULT false,
  partner_id    uuid,
  contact_phone text,
  notes         text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities.partners (
  partner_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint REFERENCES public.hotels(property_id),
  vendor_id     uuid REFERENCES ops.vendors(vendor_id),
  name          text NOT NULL,
  category      text,
  commission_pct numeric,
  contact_name  text,
  contact_phone text,
  whatsapp      text,
  notes         text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE activities.catalog
  ADD CONSTRAINT catalog_partner_fk FOREIGN KEY (partner_id)
  REFERENCES activities.partners(partner_id);
ALTER TABLE activities.guides
  ADD CONSTRAINT guides_partner_fk FOREIGN KEY (partner_id)
  REFERENCES activities.partners(partner_id);

CREATE TABLE IF NOT EXISTS activities.schedules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint REFERENCES public.hotels(property_id),
  activity_id   uuid REFERENCES activities.catalog(activity_id),
  scheduled_at  timestamptz NOT NULL,
  duration_min  int,
  capacity      int,
  guide_id      uuid REFERENCES activities.guides(guide_id),
  status        text DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities.bookings (
  booking_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       bigint REFERENCES public.hotels(property_id),
  activity_id       uuid REFERENCES activities.catalog(activity_id),
  schedule_id       uuid REFERENCES activities.schedules(id),
  reservation_id    text REFERENCES public.reservations(reservation_id),
  guest_id          text REFERENCES public.guests(guest_id),
  guest_name        text,
  guest_count       int DEFAULT 1,
  source            text,                                  -- direct | whatsapp | front_desk | partner | online
  scheduled_at      timestamptz,
  status            text DEFAULT 'booked' CHECK (status IN ('booked','confirmed','in_progress','completed','no_show','cancelled')),
  total_price       numeric,
  currency          text,
  posted_to_folio   boolean DEFAULT false,
  cloudbeds_charge_id text,
  waiver_signed     boolean DEFAULT false,
  waiver_doc_id     uuid REFERENCES docs.documents(doc_id),
  notes             text,
  raw               jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_act_book_date ON activities.bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_act_book_res  ON activities.bookings(reservation_id);

CREATE TABLE IF NOT EXISTS activities.equipment (
  id            bigserial PRIMARY KEY,
  property_id   bigint REFERENCES public.hotels(property_id),
  asset_id      uuid REFERENCES ops.assets(asset_id),
  category      text,                                  -- kayak | bike | helmet | lifejacket | tent | other
  name          text NOT NULL,
  identifier    text,
  total_units   int DEFAULT 1,
  available_units int DEFAULT 1,
  condition     text,
  last_inspected_at timestamptz,
  notes         text,
  is_active     boolean DEFAULT true
);

-- =====================================================================
-- RLS + grants + triggers
-- =====================================================================

ALTER TABLE fb.outlets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb.allergens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb.recipes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb.recipe_ingredients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb.menu_item_allergens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb.wastage_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb.food_cost_snapshots   ENABLE ROW LEVEL SECURITY;

ALTER TABLE spa.treatments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa.therapists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa.therapist_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa.treatment_bookings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa.consumables          ENABLE ROW LEVEL SECURITY;

ALTER TABLE activities.catalog       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities.guides        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities.partners      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities.schedules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities.bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities.equipment     ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_outlets_updated ON fb.outlets;
CREATE TRIGGER trg_outlets_updated BEFORE UPDATE ON fb.outlets FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_recipes_updated ON fb.recipes;
CREATE TRIGGER trg_recipes_updated BEFORE UPDATE ON fb.recipes FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_treatments_updated ON spa.treatments;
CREATE TRIGGER trg_treatments_updated BEFORE UPDATE ON spa.treatments FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_therapists_updated ON spa.therapists;
CREATE TRIGGER trg_therapists_updated BEFORE UPDATE ON spa.therapists FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_treatment_bookings_updated ON spa.treatment_bookings;
CREATE TRIGGER trg_treatment_bookings_updated BEFORE UPDATE ON spa.treatment_bookings FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_act_catalog_updated ON activities.catalog;
CREATE TRIGGER trg_act_catalog_updated BEFORE UPDATE ON activities.catalog FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_act_bookings_updated ON activities.bookings;
CREATE TRIGGER trg_act_bookings_updated BEFORE UPDATE ON activities.bookings FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

GRANT USAGE ON SCHEMA fb, spa, activities TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA fb TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA spa TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA activities TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA fb TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA spa TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA activities TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA fb TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA spa TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA activities TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA fb GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA fb GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fb GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA spa GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA spa GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA spa GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA activities GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA activities GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA activities GRANT ALL ON SEQUENCES TO service_role;
