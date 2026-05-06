-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501214958
-- Name:    phase2_05_marketing_media_grants
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- service_role needs USAGE on marketing (the original schema didn't grant it)
GRANT USAGE ON SCHEMA marketing TO service_role;

-- Grant table privileges on the 8 media_* tables created in phase2_01
GRANT SELECT, INSERT, UPDATE, DELETE ON
  marketing.media_assets,
  marketing.media_renders,
  marketing.media_taxonomy,
  marketing.media_tags,
  marketing.media_keywords_free,
  marketing.media_usage_log,
  marketing.media_collections,
  marketing.media_collection_items
TO service_role, authenticated, anon;

-- Grant on the 3 views
GRANT SELECT ON
  marketing.v_media_ready,
  marketing.v_media_by_tier,
  marketing.v_media_unused_freshness
TO service_role, authenticated, anon;

-- Grant on the sequences (serial PKs need this for INSERT)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA marketing TO service_role, authenticated;

-- Default privileges for any future tables in marketing schema
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- Tell PostgREST to reload its schema cache so the changes take effect immediately
NOTIFY pgrst, 'reload schema';
