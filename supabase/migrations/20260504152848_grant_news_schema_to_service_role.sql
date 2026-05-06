-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504152848
-- Name:    grant_news_schema_to_service_role
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


GRANT USAGE ON SCHEMA news TO service_role, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA news TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA news TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA news GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA news GRANT SELECT ON TABLES TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
