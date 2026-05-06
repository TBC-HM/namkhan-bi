-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505141229
-- Name:    security_set_search_path_user_functions_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Set search_path on all user-authored functions in user schemas.
-- Path includes pg_catalog + public + the function's own schema.
-- Excludes extension-owned functions (those break on pg_upgrade if altered).

DO $$
DECLARE
  rec record;
  alter_stmt text;
  failed_count int := 0;
  succeeded_count int := 0;
BEGIN
  FOR rec IN
    SELECT 
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname NOT IN (
      'pg_catalog','information_schema','pg_toast',
      'auth','storage','realtime','vault','extensions',
      'net','pgsodium','pgsodium_masks','supabase_migrations',
      'graphql','graphql_public','cron','_realtime','_analytics','pgbouncer'
    )
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
      ))
      AND p.prokind = 'f'
      AND d.objid IS NULL  -- skip extension-owned
  LOOP
    alter_stmt := format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, %I',
      rec.schema_name, rec.func_name, rec.args, rec.schema_name
    );
    BEGIN
      EXECUTE alter_stmt;
      succeeded_count := succeeded_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed: %.% (%): %', rec.schema_name, rec.func_name, rec.args, SQLERRM;
      failed_count := failed_count + 1;
    END;
  END LOOP;
  RAISE NOTICE 'Done. Succeeded: %, Failed: %', succeeded_count, failed_count;
END $$;
