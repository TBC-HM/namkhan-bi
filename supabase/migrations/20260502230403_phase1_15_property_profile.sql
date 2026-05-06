-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502230403
-- Name:    phase1_15_property_profile
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_15_property_profile · 2026-05-03
-- Single source of truth for property identity. See COWORK_HANDOVER notes.

BEGIN;

-- 1) Property profile table
CREATE TABLE IF NOT EXISTS marketing.property_profile (
  property_id           bigint PRIMARY KEY REFERENCES public.hotels(property_id),
  legal_name            text NOT NULL,
  trading_name          text NOT NULL,
  brand_taglines        text[] DEFAULT '{}',
  short_description     text,
  long_description      text,
  unique_selling_points text[] DEFAULT '{}',
  star_rating           int,
  category              text,
  affiliations          text[] DEFAULT '{}',
  street_line_1         text,
  street_line_2         text,
  village               text,
  district              text,
  city                  text,
  province              text,
  country               text DEFAULT 'Laos',
  postal_code           text,
  latitude              numeric(9,6),
  longitude             numeric(9,6),
  google_plus_code      text,
  what3words            text,
  website_url           text,
  booking_engine_url    text,
  primary_language      text DEFAULT 'en',
  languages_spoken      text[] DEFAULT '{en}',
  check_in_time         time DEFAULT '14:00',
  check_out_time        time DEFAULT '12:00',
  logo_url              text,
  hero_image_url        text,
  brand_color_hex       text,
  business_license_no   text,
  tax_id                text,
  vat_registered        boolean DEFAULT false,
  todo_list             text[] DEFAULT '{}',
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE marketing.property_profile IS
  'Canonical brand identity. Owner-curated, never auto-synced from Cloudbeds. '
  'todo_list = string array of fields still missing real values.';

-- 2) Contact channels
DO $$ BEGIN
  CREATE TYPE marketing.contact_kind AS ENUM
    ('phone','mobile','whatsapp','email','line','wechat','telegram','fax');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marketing.contact_purpose AS ENUM
    ('reservations','front_desk','gm','owner','marketing','billing',
     'press','hr','emergency','spa','restaurant','activities','transport','general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS marketing.property_contact (
  contact_id      bigserial PRIMARY KEY,
  property_id     bigint NOT NULL REFERENCES public.hotels(property_id),
  kind            marketing.contact_kind NOT NULL,
  purpose         marketing.contact_purpose NOT NULL,
  value           text NOT NULL,
  display_label   text,
  is_primary      boolean DEFAULT false,
  is_public       boolean DEFAULT true,
  is_active       boolean DEFAULT true,
  hours_local     text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, kind, purpose, value)
);

CREATE INDEX IF NOT EXISTS idx_property_contact_active
  ON marketing.property_contact (property_id, kind, purpose) WHERE is_active;

-- 3) RLS
ALTER TABLE marketing.property_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.property_contact ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_read ON marketing.property_profile;
CREATE POLICY profile_read ON marketing.property_profile
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS profile_write ON marketing.property_profile;
CREATE POLICY profile_write ON marketing.property_profile
  FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

DROP POLICY IF EXISTS contact_read ON marketing.property_contact;
CREATE POLICY contact_read ON marketing.property_contact
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS contact_write ON marketing.property_contact;
CREATE POLICY contact_write ON marketing.property_contact
  FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

-- 4) Card view
CREATE OR REPLACE VIEW marketing.v_property_card AS
SELECT
  p.property_id,
  p.legal_name, p.trading_name, p.brand_taglines, p.short_description,
  p.long_description, p.unique_selling_points,
  p.star_rating, p.category, p.affiliations,
  concat_ws(', ',
    nullif(p.street_line_1,''), nullif(p.village,''),
    nullif(p.district,''), nullif(p.city,''),
    nullif(p.country,'')) AS formatted_address,
  p.street_line_1, p.street_line_2, p.village, p.district, p.city,
  p.province, p.country, p.postal_code,
  p.latitude, p.longitude, p.google_plus_code, p.what3words,
  p.website_url, p.booking_engine_url,
  p.primary_language, p.languages_spoken,
  p.check_in_time, p.check_out_time,
  p.logo_url, p.hero_image_url, p.brand_color_hex,
  (SELECT jsonb_object_agg(
    concat(c.kind::text, '_', c.purpose::text), c.value)
   FROM marketing.property_contact c
   WHERE c.property_id = p.property_id AND c.is_primary AND c.is_active
  ) AS primary_contacts,
  (SELECT jsonb_agg(jsonb_build_object(
    'kind', c.kind, 'purpose', c.purpose, 'value', c.value,
    'label', c.display_label, 'primary', c.is_primary,
    'public', c.is_public, 'hours', c.hours_local) ORDER BY c.is_primary DESC, c.kind)
   FROM marketing.property_contact c
   WHERE c.property_id = p.property_id AND c.is_active
  ) AS all_contacts,
  (SELECT jsonb_agg(jsonb_build_object(
    'platform', s.platform, 'handle', s.handle, 'url', s.url,
    'display_name', s.display_name) ORDER BY s.platform)
   FROM marketing.social_accounts s
   WHERE s.active
  ) AS social_accounts,
  p.business_license_no, p.tax_id, p.vat_registered,
  p.todo_list,
  p.updated_at
FROM marketing.property_profile p;

COMMENT ON VIEW marketing.v_property_card IS
  'One-stop property identity card. Joins property_profile + property_contact + social_accounts.';

-- 5) Seed The Namkhan
INSERT INTO marketing.property_profile (
  property_id, legal_name, trading_name,
  brand_taglines, short_description,
  unique_selling_points,
  star_rating, category, affiliations,
  city, province, country,
  website_url, booking_engine_url,
  languages_spoken, check_in_time, check_out_time,
  todo_list
) VALUES (
  260955,
  'The Namkhan',
  'The Namkhan',
  ARRAY['Considerate luxury on the river','A riverside retreat in Luang Prabang'],
  'Eco-luxury and wellness sanctuary on the Nam Khan river, Luang Prabang. SLH Considerate Collection.',
  ARRAY[
    'Riverfront and jungle setting, 15 min from UNESCO Old Town',
    '24 unique units: glamping tents, villas, river-view suites, art deluxe rooms',
    'Holistic wellness — daily yoga, in-house physician, Jungle Spa with sauna and ice bath',
    'Roots Restaurant — organic farm-to-table, seasonal Lao cuisine',
    'SLH Considerate Collection member, Hilton Honors partner',
    'Complimentary shuttle to Old Town and night market'
  ],
  5,
  'Eco-luxury wellness retreat',
  ARRAY['Small Luxury Hotels of the World – Considerate Collection','Hilton Honors'],
  'Luang Prabang',
  'Luang Prabang',
  'Laos',
  'https://www.thenamkhan.com',
  'https://hotels.cloudbeds.com/en/reservation/lKAMWp?currency=usd',
  ARRAY['en','lo','fr','th'],
  '14:00',
  '12:00',
  ARRAY[
    'street_line_1 / village — physical address',
    'latitude / longitude',
    'google_plus_code',
    'logo_url',
    'hero_image_url',
    'brand_color_hex',
    'business_license_no',
    'tax_id',
    'long_description (markdown, replaces public.hotels HTML)',
    'whatsapp number — confirm same as +856 30 999 7327 or different',
    'gm direct phone + email',
    'owner direct phone + email',
    'emergency contact',
    'expedia listing URL',
    'agoda listing URL',
    'verify facebook URL',
    'verify google business URL',
    'verify tripadvisor URL'
  ]
) ON CONFLICT (property_id) DO UPDATE SET
  brand_taglines = EXCLUDED.brand_taglines,
  short_description = EXCLUDED.short_description,
  unique_selling_points = EXCLUDED.unique_selling_points,
  affiliations = EXCLUDED.affiliations,
  city = EXCLUDED.city,
  province = EXCLUDED.province,
  country = EXCLUDED.country,
  website_url = EXCLUDED.website_url,
  booking_engine_url = EXCLUDED.booking_engine_url,
  languages_spoken = EXCLUDED.languages_spoken,
  todo_list = EXCLUDED.todo_list,
  updated_at = now();

-- 6) Seed contact channels
INSERT INTO marketing.property_contact (property_id, kind, purpose, value, is_primary, is_public)
VALUES
  (260955, 'phone', 'reservations', '+856 30 999 7327', true, true),
  (260955, 'whatsapp', 'reservations', '+856 30 999 7327', true, true),  -- assumed same; flagged in todo_list
  (260955, 'email', 'reservations', 'book@thenamkhan.com', true, true)
ON CONFLICT (property_id, kind, purpose, value) DO NOTHING;

-- 7) Update social_accounts with the corrected URLs
UPDATE marketing.social_accounts SET
  handle = '@the_namkhan_resort',
  url = 'https://www.instagram.com/the_namkhan_resort/',
  updated_at = now()
WHERE platform = 'instagram';

UPDATE marketing.social_accounts SET
  handle = '@the_namkhan',
  url = 'https://www.youtube.com/@the_namkhan',
  updated_at = now()
WHERE platform = 'youtube';

UPDATE marketing.social_accounts SET
  handle = '@the.namkhan',
  url = 'https://www.tiktok.com/@the.namkhan',
  updated_at = now()
WHERE platform = 'tiktok';

UPDATE marketing.social_accounts SET
  url = 'https://www.booking.com/hotel/la/namkhan-ecolodge.html',
  notes = 'Stripped tracking params; canonical URL only',
  updated_at = now()
WHERE platform = 'booking';

UPDATE marketing.social_accounts SET
  notes = COALESCE(notes,'') || ' [TODO: verify URL with owner]',
  updated_at = now()
WHERE platform IN ('facebook','google_business','tripadvisor');

COMMIT;