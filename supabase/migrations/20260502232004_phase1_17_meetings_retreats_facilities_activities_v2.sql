-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502232004
-- Name:    phase1_17_meetings_retreats_facilities_activities_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Tables only. RLS in separate migration.

CREATE TABLE IF NOT EXISTS marketing.meeting_rooms (
  meeting_room_id    bigserial PRIMARY KEY,
  property_id        bigint NOT NULL REFERENCES public.hotels(property_id),
  code               text NOT NULL,
  display_name       text NOT NULL,
  capacity_min_pax   int NOT NULL,
  capacity_max_pax   int NOT NULL,
  size_sqm           numeric(6,1),
  features           jsonb DEFAULT '{}'::jsonb,
  is_active          boolean DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, code)
);

CREATE TABLE IF NOT EXISTS marketing.meeting_packages (
  package_id         bigserial PRIMARY KEY,
  property_id        bigint NOT NULL REFERENCES public.hotels(property_id),
  package_type       text NOT NULL,
  meeting_room_code  text,
  package_name       text NOT NULL,
  duration_hours     int,
  pricing_basis      text NOT NULL,
  price_usd          numeric(10,2) NOT NULL,
  price_lak          numeric(14,0),
  currency_note      text DEFAULT '1 USD ≈ 22,000 LAK (sales rounded; live FX in gl.fx_rates)',
  inclusions         text[] DEFAULT '{}',
  premium_upgrades   text[] DEFAULT '{}',
  is_active          boolean DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing.retreat_programs (
  retreat_id         bigserial PRIMARY KEY,
  property_id        bigint NOT NULL REFERENCES public.hotels(property_id),
  code               text NOT NULL UNIQUE,
  display_name       text NOT NULL,
  short_pitch        text,
  long_description   text,
  ideal_for          text[] DEFAULT '{}',
  min_nights         int DEFAULT 2,
  max_nights         int DEFAULT 6,
  min_age            int DEFAULT 16,
  pricing_basis      text NOT NULL,
  eligible_room_types text[] DEFAULT '{}',
  excluded_seasons   text[] DEFAULT '{}',
  essential_inclusions text[] DEFAULT '{}',
  immersion_inclusions text[] DEFAULT '{}',
  is_active          boolean DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing.retreat_pricing (
  pricing_id         bigserial PRIMARY KEY,
  retreat_id         bigint NOT NULL REFERENCES marketing.retreat_programs(retreat_id),
  tier               text NOT NULL,
  season             text NOT NULL,
  audience           text NOT NULL,
  price_usd          numeric(10,2) NOT NULL,
  taxes_included     boolean DEFAULT false,
  service_charge_pct numeric(4,2) DEFAULT 10.00,
  vat_pct            numeric(4,2) DEFAULT 10.00,
  effective_from     date,
  effective_to       date,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retreat_id, tier, season, audience)
);

CREATE TABLE IF NOT EXISTS marketing.seasons (
  season_id          bigserial PRIMARY KEY,
  property_id        bigint NOT NULL REFERENCES public.hotels(property_id),
  season_code        text NOT NULL,
  display_name       text NOT NULL,
  date_start         date NOT NULL,
  date_end           date NOT NULL,
  is_active          boolean DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing.facilities (
  facility_id        bigserial PRIMARY KEY,
  property_id        bigint NOT NULL REFERENCES public.hotels(property_id),
  category           text NOT NULL,
  name               text NOT NULL,
  description        text,
  hours              text,
  is_complimentary   boolean DEFAULT true,
  is_active          boolean DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, name)
);

CREATE TABLE IF NOT EXISTS marketing.activities_catalog (
  activity_id        bigserial PRIMARY KEY,
  property_id        bigint NOT NULL REFERENCES public.hotels(property_id),
  category           text NOT NULL,
  name               text NOT NULL,
  description        text,
  duration_min       int,
  group_type         text,
  age_restriction    text,
  bookable_via       text,
  is_complimentary   boolean DEFAULT false,
  is_active          boolean DEFAULT true,
  display_order      int DEFAULT 100,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, name)
);

ALTER TABLE marketing.meeting_rooms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.meeting_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.retreat_programs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.retreat_pricing     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.seasons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.facilities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.activities_catalog  ENABLE ROW LEVEL SECURITY;