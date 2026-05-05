-- =====================================================================
-- Rollback: 20260504000000_retreat_compiler_init_a1b2c3d4
-- Drops retreat-compiler additions. Does NOT touch public/marketing/guest/gl.
-- =====================================================================

BEGIN;

-- Drop RPCs
DROP FUNCTION IF EXISTS web.capture_lead(text,text,text,uuid,text[],text,text,jsonb);
DROP FUNCTION IF EXISTS web.track_event(text,text,uuid,uuid,uuid,numeric,jsonb,text,text,text,text);

-- Drop view
DROP VIEW IF EXISTS catalog.v_rooms_compilable;

-- Drop schemas with everything inside
DROP SCHEMA IF EXISTS book CASCADE;
DROP SCHEMA IF EXISTS web CASCADE;
DROP SCHEMA IF EXISTS compiler CASCADE;
DROP SCHEMA IF EXISTS pricing CASCADE;
DROP SCHEMA IF EXISTS catalog CASCADE;
DROP SCHEMA IF EXISTS content CASCADE;

-- Reset PostgREST exposure (revert to known prior list)
DO $$
BEGIN
  EXECUTE 'ALTER ROLE authenticator SET pgrst.db_schemas TO ''public, graphql_public, marketing, guest, gl''';
  PERFORM pg_notify('pgrst', 'reload config');
END $$;

COMMIT;
