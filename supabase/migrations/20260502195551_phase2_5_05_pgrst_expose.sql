-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502195551
-- Name:    phase2_5_05_pgrst_expose
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- MERGE new schemas into pgrst.db_schemas (current = public, graphql_public, marketing, governance, guest, gl)
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc';
NOTIFY pgrst, 'reload config';
