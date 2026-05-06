-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504163832
-- Name:    payroll_loader_public_proxy
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION public.payroll_load(p_rows jsonb)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = ops, public
AS $$
  SELECT ops.f_payroll_loader(p_rows);
$$;
GRANT EXECUTE ON FUNCTION public.payroll_load(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.payroll_load(jsonb) FROM PUBLIC, anon, authenticated;
