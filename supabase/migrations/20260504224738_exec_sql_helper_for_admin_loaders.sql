-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504224738
-- Name:    exec_sql_helper_for_admin_loaders
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Tiny SECURITY DEFINER helper used by service-role-only batch loaders to push
-- raw SQL via PostgREST /rpc. Locked to service_role.
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;