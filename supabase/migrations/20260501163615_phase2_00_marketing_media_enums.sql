-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501163615
-- Name:    phase2_00_marketing_media_enums
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Phase 1 (Media Pipeline) — enums
CREATE TYPE marketing.asset_type AS ENUM ('photo','video','reel','panorama_360','raw_dng');
CREATE TYPE marketing.asset_status AS ENUM (
  'ingested','qc_passed','qc_failed','enhanced','tagged','ready',
  'needs_review','archived','removed'
);
CREATE TYPE marketing.license_type AS ENUM (
  'owned','licensed','cc_by','editorial_only','influencer_ugc','guest_ugc'
);
CREATE TYPE marketing.usage_tier AS ENUM (
  'tier_ota_profile','tier_website_hero','tier_social_pool',
  'tier_internal','tier_archive'
);
CREATE TYPE marketing.taxonomy_category AS ENUM (
  'subject','mood','time_of_day','season','weather','room_type',
  'property_area','activity','food_beverage','people','style','event'
);
CREATE TYPE marketing.render_purpose AS ENUM (
  'print_4k','web_2k','ota_main','hero_16x9','ig_square','ig_portrait',
  'ig_story','reel','email','thumbnail'
);
