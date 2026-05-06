-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505141001
-- Name:    security_revoke_anon_writes_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Same as before but exclude Supabase-managed schemas

-- Step 1: Revoke writes on the 5 dangerous public tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE 
  public.action_decisions,
  public.app_settings,
  public.app_users,
  public.catalog_cleanup_decisions,
  public.reservation_rooms_backup_20260503
FROM anon, authenticated;

-- Step 2: Reset future-table defaults in user schemas only
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT 
      pg_get_userbyid(d.defaclrole) AS owner_role,
      n.nspname AS schema_name
    FROM pg_default_acl d
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE d.defaclobjtype = 'r'
      AND n.nspname IS NOT NULL
      AND n.nspname NOT IN (
        'pg_catalog','information_schema','pg_toast',
        'auth','storage','realtime','vault','extensions',
        'net','pgsodium','pgsodium_masks','supabase_migrations',
        'graphql','graphql_public','cron','_realtime','_analytics','pgbouncer'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated',
        rec.owner_role, rec.schema_name
      );
    EXCEPTION WHEN insufficient_privilege THEN
      -- Skip if we don't own the default privileges
      NULL;
    END;
  END LOOP;
END $$;

-- Step 3: Enable RLS with permissive read policies on the 4 public tables in active use
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_users_read ON public.app_users;
CREATE POLICY app_users_read ON public.app_users 
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings 
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.action_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS action_decisions_read ON public.action_decisions;
CREATE POLICY action_decisions_read ON public.action_decisions 
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.catalog_cleanup_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalog_cleanup_decisions_read ON public.catalog_cleanup_decisions;
CREATE POLICY catalog_cleanup_decisions_read ON public.catalog_cleanup_decisions 
  FOR SELECT TO anon, authenticated USING (true);

-- Backup table: RLS on, no read policy → anon/auth see zero rows. Service role retains full access.
ALTER TABLE public.reservation_rooms_backup_20260503 ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
