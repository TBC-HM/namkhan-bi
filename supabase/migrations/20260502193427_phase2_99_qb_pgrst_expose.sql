-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502193427
-- Name:    phase2_99_qb_pgrst_expose
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, marketing, governance, guest, gl, qb';

GRANT USAGE ON SCHEMA qb TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES    IN SCHEMA qb TO authenticated, service_role;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA qb TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA qb TO service_role;
GRANT USAGE,  UPDATE         ON ALL SEQUENCES IN SCHEMA qb TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA qb TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA qb GRANT SELECT ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA qb GRANT INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA qb GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

NOTIFY pgrst, 'reload config';