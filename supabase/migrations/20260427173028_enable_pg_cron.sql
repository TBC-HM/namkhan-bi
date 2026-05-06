-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427173028
-- Name:    enable_pg_cron
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA cron TO postgres;
