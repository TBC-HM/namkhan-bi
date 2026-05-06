-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502231002
-- Name:    phase1_15c_v_property_card_brand_fields_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP VIEW IF EXISTS marketing.v_property_card;
CREATE VIEW marketing.v_property_card AS
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
  p.brand_palette, p.brand_typography, p.brand_logo_variants, p.brand_assets_url,
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
  p.todo_list, p.updated_at
FROM marketing.property_profile p;