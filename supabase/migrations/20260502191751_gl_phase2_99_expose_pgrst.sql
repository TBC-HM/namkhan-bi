-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502191751
-- Name:    gl_phase2_99_expose_pgrst
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- MODIFIED vs v2: preserve existing governance schema in pgrst.db_schemas.
-- Current setting before this migration: public, graphql_public, marketing, governance, guest
-- New setting: public, graphql_public, marketing, governance, guest, gl
ALTER ROLE authenticator
  SET pgrst.db_schemas TO 'public, graphql_public, marketing, governance, guest, gl';

NOTIFY pgrst, 'reload config';

GRANT USAGE ON SCHEMA gl TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES    IN SCHEMA gl TO anon, authenticated, service_role;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA gl TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA gl TO service_role;
GRANT USAGE,  UPDATE         ON ALL SEQUENCES IN SCHEMA gl TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gl TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA gl GRANT SELECT ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA gl GRANT INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA gl GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

DO $$
DECLARE exposed text;
BEGIN
  SELECT array_to_string(setconfig, ' | ') INTO exposed
  FROM pg_db_role_setting drs
  JOIN pg_roles r ON r.oid = drs.setrole
  WHERE r.rolname = 'authenticator';
  RAISE NOTICE 'authenticator setconfig: %', exposed;
  IF exposed IS NULL OR position('gl' in exposed) = 0 THEN
    RAISE EXCEPTION 'gl schema NOT in pgrst.db_schemas';
  END IF;
END $$;
