-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504152720
-- Name:    expose_news_schema_to_postgrest
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Append 'news' to existing pgrst.db_schemas (MERGE — never overwrite)
ALTER ROLE authenticator SET pgrst.db_schemas TO
  'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc, sales, ops, plan, dq, kpi, docs, news';
NOTIFY pgrst, 'reload config';
