-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502235457
-- Name:    phase1_21_settings_sections_index
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW marketing.v_settings_sections AS
SELECT
  section_code::text,
  display_name::text,
  description::text,
  source_table::text,
  display_order::int
FROM (VALUES
  ('property_identity',    'Property Identity',     'Legal name, taglines, descriptions, USPs',                'property_profile',     1),
  ('location_climate',     'Location & Climate',    'GPS, address, distances, climate, shuttle',               'property_profile',     2),
  ('contacts',             'Contacts',              'Phone, email, WhatsApp, billing — by purpose',            'property_contact',     3),
  ('social',               'Social Media',          'Instagram, FB, TikTok, OTAs, etc.',                       'social_accounts',      4),
  ('rooms',                'Room Content',          'Owner-curated descriptions, sizes, amenities (mirrors Cloudbeds)', 'room_type_content', 5),
  ('booking_policies',     'Booking Policies',      'Confirmation, payment, cancellation, group terms',        'booking_policies',     6),
  ('certifications',       'Certifications',        'SLH, ASEAN Green, Plastic-Free, Hilton Honors, etc.',     'certifications',       7),
  ('facilities',           'Facilities',            'Pools, restaurants, spa, sports — categorized',           'facilities',           8),
  ('activities',           'Activities Catalog',    'Yoga, cooking, kayaking, etc. (marketing list)',          'activities_catalog',   9),
  ('meeting_rooms',        'Meeting Rooms',         'S/M/L/XL configs',                                        'meeting_rooms',        10),
  ('meeting_packages',     'Meeting Packages',      'Room rental + Smart + Hybrid + Add-ons rate cards',       'meeting_packages',     11),
  ('retreats',             'Retreat Programs',      'Harmony, Detox, Serene Couples + tiered pricing',         'retreat_programs',     12),
  ('retreat_pricing',      'Retreat Pricing Matrix','Tier × Season × Audience pricing grid',                   'retreat_pricing',      13),
  ('seasons',              'Seasons',               'High / Green date blocks',                                'seasons',              14),
  ('brand',                'Brand Identity',        'Palette, typography, logo variants, assets URL',          'property_profile',     15)
) AS v(section_code, display_name, description, source_table, display_order);

CREATE OR REPLACE VIEW marketing.v_settings_sections_live AS
SELECT
  s.section_code,
  s.display_name,
  s.description,
  s.source_table,
  s.display_order,
  CASE s.source_table
    WHEN 'property_profile'    THEN (SELECT count(*) FROM marketing.property_profile)
    WHEN 'property_contact'    THEN (SELECT count(*) FROM marketing.property_contact)
    WHEN 'social_accounts'     THEN (SELECT count(*) FROM marketing.social_accounts WHERE active = true)
    WHEN 'room_type_content'   THEN (SELECT count(*) FROM marketing.room_type_content)
    WHEN 'booking_policies'    THEN (SELECT count(*) FROM marketing.booking_policies)
    WHEN 'certifications'      THEN (SELECT count(*) FROM marketing.certifications WHERE is_active = true)
    WHEN 'facilities'          THEN (SELECT count(*) FROM marketing.facilities WHERE is_active = true)
    WHEN 'activities_catalog'  THEN (SELECT count(*) FROM marketing.activities_catalog WHERE is_active = true)
    WHEN 'meeting_rooms'       THEN (SELECT count(*) FROM marketing.meeting_rooms WHERE is_active = true)
    WHEN 'meeting_packages'    THEN (SELECT count(*) FROM marketing.meeting_packages WHERE is_active = true)
    WHEN 'retreat_programs'    THEN (SELECT count(*) FROM marketing.retreat_programs WHERE is_active = true)
    WHEN 'retreat_pricing'     THEN (SELECT count(*) FROM marketing.retreat_pricing)
    WHEN 'seasons'             THEN (SELECT count(*) FROM marketing.seasons WHERE is_active = true)
    ELSE 0
  END AS row_count,
  CASE s.source_table
    WHEN 'property_profile'    THEN (SELECT max(updated_at) FROM marketing.property_profile)
    WHEN 'property_contact'    THEN (SELECT max(updated_at) FROM marketing.property_contact)
    WHEN 'social_accounts'     THEN (SELECT max(updated_at) FROM marketing.social_accounts)
    WHEN 'room_type_content'   THEN (SELECT max(updated_at) FROM marketing.room_type_content)
    WHEN 'booking_policies'    THEN (SELECT max(updated_at) FROM marketing.booking_policies)
    WHEN 'certifications'      THEN (SELECT max(updated_at) FROM marketing.certifications)
    WHEN 'facilities'          THEN (SELECT max(updated_at) FROM marketing.facilities)
    WHEN 'activities_catalog'  THEN (SELECT max(updated_at) FROM marketing.activities_catalog)
    WHEN 'meeting_rooms'       THEN (SELECT max(updated_at) FROM marketing.meeting_rooms)
    WHEN 'meeting_packages'    THEN (SELECT max(updated_at) FROM marketing.meeting_packages)
    WHEN 'retreat_programs'    THEN (SELECT max(updated_at) FROM marketing.retreat_programs)
    WHEN 'retreat_pricing'     THEN (SELECT max(updated_at) FROM marketing.retreat_pricing)
    WHEN 'seasons'             THEN (SELECT max(updated_at) FROM marketing.seasons)
  END AS last_edited
FROM marketing.v_settings_sections s
ORDER BY s.display_order;

COMMENT ON VIEW marketing.v_settings_sections_live IS
  'Drives Settings → Property Profile UI. One row per editable section with live row count + last-edited.';

GRANT SELECT ON marketing.v_settings_sections      TO authenticated;
GRANT SELECT ON marketing.v_settings_sections_live TO authenticated;