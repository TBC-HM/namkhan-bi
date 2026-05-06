-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501212528
-- Name:    phase2_staff_detail_public_proxies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Public-schema proxies + grants for the new ops views.
-- ops is NOT in PostgREST exposed_schemas; without proxies the anon
-- supabase-js client returns null/empty.

DROP VIEW IF EXISTS public.v_staff_register_extended CASCADE;
CREATE VIEW public.v_staff_register_extended AS
  SELECT * FROM ops.v_staff_register_extended;

DROP VIEW IF EXISTS public.v_staff_anomalies CASCADE;
CREATE VIEW public.v_staff_anomalies AS
  SELECT * FROM ops.v_staff_anomalies;

DROP VIEW IF EXISTS public.v_staff_detail CASCADE;
CREATE VIEW public.v_staff_detail AS
  SELECT * FROM ops.v_staff_detail;

GRANT SELECT ON public.v_staff_register_extended TO anon, authenticated;
GRANT SELECT ON public.v_staff_anomalies         TO anon, authenticated;
GRANT SELECT ON public.v_staff_detail            TO anon, authenticated;

GRANT USAGE ON SCHEMA ops TO anon, authenticated;
GRANT SELECT ON ops.v_staff_register          TO anon, authenticated;
GRANT SELECT ON ops.v_staff_register_extended TO anon, authenticated;
GRANT SELECT ON ops.v_staff_anomalies         TO anon, authenticated;
GRANT SELECT ON ops.v_staff_detail            TO anon, authenticated;