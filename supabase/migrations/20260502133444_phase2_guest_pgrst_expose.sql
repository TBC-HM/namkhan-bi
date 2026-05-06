-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502133444
-- Name:    phase2_guest_pgrst_expose
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Expose the `guest` schema to PostgREST so the v2 Guest Directory frontend
-- can read guest.mv_guest_profile / guest.v_directory_facets and call
-- guest.directory_headline() via .schema('guest').
-- Current authenticator config: 'public, graphql_public, marketing, governance'

ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, marketing, governance, guest';

GRANT USAGE ON SCHEMA guest TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA guest TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA guest TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA guest GRANT SELECT ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA guest GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload config';