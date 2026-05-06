-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502235311
-- Name:    phase1_19_factsheet_consolidated_view
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW marketing.v_namkhan_factsheet AS
SELECT
  pp.property_id,

  jsonb_build_object(
    'legal_name', pp.legal_name,
    'trading_name', pp.trading_name,
    'category', '5-star boutique eco-retreat',
    'star_rating', 5,
    'taglines', pp.brand_taglines,
    'short_description', pp.short_description,
    'long_description', pp.long_description,
    'usps', pp.unique_selling_points
  ) AS identity,

  jsonb_build_object(
    'address_line', pp.street_line_1,
    'village', 'Don Keo Village',
    'city', 'Luang Prabang',
    'country', 'Laos',
    'postal_code', '06000',
    'latitude', pp.latitude,
    'longitude', pp.longitude,
    'timezone', pp.timezone,
    'airport_km', pp.airport_distance_km,
    'airport_min', pp.airport_drive_time_min,
    'train_km', pp.train_distance_km,
    'train_min', pp.train_drive_time_min,
    'bus_min', pp.bus_drive_time_min,
    'shuttle_available', pp.shuttle_available,
    'shuttle_description', pp.shuttle_description,
    'climate_summary', pp.climate_summary,
    'climate_temp_min_c', pp.climate_temp_min_c,
    'climate_temp_max_c', pp.climate_temp_max_c,
    'climate_rainy_months', pp.climate_rainy_months
  ) AS location,

  jsonb_build_object(
    'rooms_total', 30,
    'rooms_selling', 24,
    'room_types_count', (SELECT count(*) FROM marketing.room_type_content WHERE property_id = pp.property_id)
  ) AS capacity,

  (SELECT jsonb_agg(jsonb_build_object(
      'kind', kind, 'purpose', purpose, 'value', value,
      'label', display_label, 'is_primary', is_primary
    ) ORDER BY is_primary DESC, kind)
   FROM marketing.property_contact
   WHERE property_id = pp.property_id AND is_public = true AND is_active = true
  ) AS contacts,

  jsonb_build_object(
    'website', pp.website_url,
    'booking_engine', pp.booking_engine_url,
    'google_maps_url', pp.google_maps_url
  ) AS web,

  (SELECT jsonb_object_agg(platform, jsonb_build_object('handle', handle, 'url', url))
   FROM marketing.social_accounts
   WHERE active = true
  ) AS social,

  (SELECT jsonb_agg(jsonb_build_object(
      'body', certifying_body, 'name', certification_name, 'level', level
    ) ORDER BY certifying_body)
   FROM marketing.certifications
   WHERE property_id = pp.property_id AND is_active = true
  ) AS certifications,

  (SELECT jsonb_agg(jsonb_build_object(
      'room_type_id', rt.room_type_id,
      'name', rtc.display_name,
      'units', rt.quantity,
      'size_sqm', rtc.size_sqm,
      'garden_sqm', rtc.garden_sqm,
      'max_occupancy', rtc.max_occupancy,
      'tier', rtc.positioning_tier,
      'positioning', rtc.positioning_label,
      'view_type', rtc.view_type,
      'bed_config', rtc.bed_config,
      'extra_bed', rtc.extra_bed_allowed,
      'short_pitch', rtc.short_pitch,
      'long_description', rtc.long_description,
      'amenities', rtc.amenities,
      'ideal_for', rtc.ideal_for,
      'hero_image_url', rtc.hero_image_url
    ) ORDER BY
      CASE rtc.positioning_tier WHEN 'premium' THEN 1 WHEN 'signature' THEN 2 WHEN 'entry' THEN 3 ELSE 4 END,
      rtc.size_sqm DESC NULLS LAST)
   FROM public.room_types rt
   JOIN marketing.room_type_content rtc ON rtc.room_type_id = rt.room_type_id
   WHERE rt.property_id = pp.property_id
  ) AS rooms,

  (SELECT jsonb_object_agg(category, items)
   FROM (
     SELECT category, jsonb_agg(jsonb_build_object(
       'name', name, 'description', description, 'complimentary', is_complimentary
     ) ORDER BY name) AS items
     FROM marketing.facilities
     WHERE property_id = pp.property_id AND is_active = true
     GROUP BY category
   ) f
  ) AS facilities,

  (SELECT jsonb_object_agg(category, items)
   FROM (
     SELECT category, jsonb_agg(jsonb_build_object(
       'name', name, 'description', description,
       'group_type', group_type, 'complimentary', is_complimentary
     ) ORDER BY display_order, name) AS items
     FROM marketing.activities_catalog
     WHERE property_id = pp.property_id AND is_active = true
     GROUP BY category
   ) a
  ) AS activities,

  jsonb_build_object(
    'rooms', (SELECT jsonb_agg(jsonb_build_object(
        'code', code, 'name', display_name,
        'capacity_min', capacity_min_pax, 'capacity_max', capacity_max_pax,
        'features', features
      ) ORDER BY capacity_min_pax)
      FROM marketing.meeting_rooms
      WHERE property_id = pp.property_id AND is_active = true),
    'packages', (SELECT jsonb_agg(jsonb_build_object(
        'type', package_type, 'room_code', meeting_room_code,
        'name', package_name, 'duration_hours', duration_hours,
        'basis', pricing_basis, 'price_usd', price_usd, 'price_lak', price_lak,
        'inclusions', inclusions, 'premium_upgrades', premium_upgrades
      ) ORDER BY package_type, price_usd)
      FROM marketing.meeting_packages
      WHERE property_id = pp.property_id AND is_active = true)
  ) AS meetings,

  (SELECT jsonb_agg(jsonb_build_object(
      'code', rp.code,
      'name', rp.display_name,
      'short_pitch', rp.short_pitch,
      'long_description', rp.long_description,
      'min_nights', rp.min_nights,
      'max_nights', rp.max_nights,
      'min_age', rp.min_age,
      'pricing_basis', rp.pricing_basis,
      'eligible_rooms', rp.eligible_room_types,
      'ideal_for', rp.ideal_for,
      'essential_inclusions', rp.essential_inclusions,
      'immersion_inclusions', rp.immersion_inclusions,
      'pricing', (
        SELECT jsonb_agg(jsonb_build_object(
          'tier', tier, 'season', season, 'audience', audience,
          'price_usd', price_usd,
          'taxes_included', taxes_included,
          'service_charge_pct', service_charge_pct,
          'vat_pct', vat_pct
        ) ORDER BY tier, audience, season)
        FROM marketing.retreat_pricing rpr
        WHERE rpr.retreat_id = rp.retreat_id
      )
    ) ORDER BY rp.code)
   FROM marketing.retreat_programs rp
   WHERE rp.property_id = pp.property_id AND rp.is_active = true
  ) AS retreats,

  (SELECT jsonb_agg(jsonb_build_object(
      'code', season_code, 'name', display_name,
      'start', date_start, 'end', date_end
    ) ORDER BY date_start)
   FROM marketing.seasons
   WHERE property_id = pp.property_id AND is_active = true
  ) AS seasons,

  (SELECT jsonb_build_object(
      'confirmation', confirmation_rules,
      'required_guest_details', required_guest_details,
      'guest_details_deadline_days', guest_details_deadline_days,
      'non_compliance', non_compliance_consequence,
      'fit_payment', fit_payment_terms,
      'group_payment', group_payment_terms,
      'payment_methods', accepted_payment_methods,
      'cancellation', cancellation_policy,
      'no_show', no_show_policy,
      'early_departure', early_departure_policy,
      'modifications', modification_policy,
      'group_terms', group_booking_terms,
      'min_nights_recommended', recommended_min_nights,
      'selling_approach', selling_approach,
      'liability', liability_clause,
      'final_note', final_note
    )
   FROM marketing.booking_policies
   WHERE property_id = pp.property_id
  ) AS policies,

  jsonb_build_object(
    'palette', pp.brand_palette,
    'typography', pp.brand_typography,
    'logo_variants', pp.brand_logo_variants,
    'assets_url', pp.brand_assets_url
  ) AS brand,

  pp.todo_list AS todos,
  pp.updated_at AS profile_updated_at,
  now() AS factsheet_generated_at

FROM marketing.property_profile pp;

COMMENT ON VIEW marketing.v_namkhan_factsheet IS
  'Single consolidated source of truth for sales/marketing/agents. Pulls from 13 marketing tables. Read-only.';

GRANT SELECT ON marketing.v_namkhan_factsheet TO authenticated;