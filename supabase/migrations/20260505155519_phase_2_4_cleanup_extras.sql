-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155519
-- Name:    phase_2_4_cleanup_extras
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.4 — cleanup of extras flagged after phase 2.3
-- =====================================================================

-- Fix mutable search_path on core trigger function
CREATE OR REPLACE FUNCTION core.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- Lock down the BI refresh functions discovered after phase 1
REVOKE EXECUTE ON FUNCTION public.refresh_bi_views_hot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_bi_views_warm() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_bi_views_hot() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_bi_views_warm() TO service_role;
