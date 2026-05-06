-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428152858
-- Name:    harden_security_before_public_deploy
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- CRITICAL: lock down everything before the front-end goes live on the public
-- internet. Front-end only needs SELECT on the BI mat views + a couple of
-- reference tables. Nothing else should be exposed.
-- =============================================================================

-- 1) REVOKE all sync/admin SECURITY DEFINER functions from anon + authenticated.
--    These were exposed for internal cron/edge-function callers; the dashboard
--    must NEVER hit them. get_secret in particular leaks the Cloudbeds API key.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'cb_auth_header','cb_collect','cb_drain_step','cb_fire_batch',
        'cb_get','cb_hourly_refresh','cb_plan_pages','cb_process_reservations',
        'cb_process_transactions','cb_retry_failed','cb_run_waves',
        'cb_sync_recent_reservations','get_secret','invoke_sync',
        'recompute_daily_metrics'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated, public',
      fn.nspname, fn.proname, fn.args);
  END LOOP;
END $$;

-- 2) Tables exposed via PostgREST without RLS = public read/write.
--    Enable RLS on every table, then add a read-only policy for anon ONLY where
--    the front-end actually needs it. Everything else is locked.

-- Tables the front-end DOES need (read-only)
ALTER TABLE public.rate_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.rate_plans;
CREATE POLICY allow_anon_read ON public.rate_plans FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.rate_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.rate_inventory;
CREATE POLICY allow_anon_read ON public.rate_inventory FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.house_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.house_accounts;
CREATE POLICY allow_anon_read ON public.house_accounts FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.dq_known_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.dq_known_issues;
CREATE POLICY allow_anon_read ON public.dq_known_issues FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.operational_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.operational_overrides;
CREATE POLICY allow_anon_read ON public.operational_overrides FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.usali_category_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.usali_category_map;
CREATE POLICY allow_anon_read ON public.usali_category_map FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.market_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.market_segments;
CREATE POLICY allow_anon_read ON public.market_segments FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.item_categories;
CREATE POLICY allow_anon_read ON public.item_categories FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.items;
CREATE POLICY allow_anon_read ON public.items FOR SELECT TO anon, authenticated USING (true);

-- Tables the front-end does NOT need: enable RLS, no policy = no rows readable.
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_insights_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes_and_fees_config ENABLE ROW LEVEL SECURITY;

-- Sync internals must NEVER be exposed
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_request_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_watermarks ENABLE ROW LEVEL SECURITY;

-- Also enable RLS on the original "live" tables that the front-end DOES read.
-- We need to add policies for these:
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.reservations;
CREATE POLICY allow_anon_read ON public.reservations FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.reservation_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.reservation_rooms;
CREATE POLICY allow_anon_read ON public.reservation_rooms FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.transactions;
CREATE POLICY allow_anon_read ON public.transactions FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.rooms;
CREATE POLICY allow_anon_read ON public.rooms FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.room_types;
CREATE POLICY allow_anon_read ON public.room_types FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
-- guests = PII, NO anon policy. Front-end does not need direct access.

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.sources;
CREATE POLICY allow_anon_read ON public.sources FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.hotels;
CREATE POLICY allow_anon_read ON public.hotels FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.daily_metrics;
CREATE POLICY allow_anon_read ON public.daily_metrics FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.channel_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_anon_read ON public.channel_metrics;
CREATE POLICY allow_anon_read ON public.channel_metrics FOR SELECT TO anon, authenticated USING (true);

-- 3) Fix the SECURITY DEFINER on public views by recreating with security_invoker.
ALTER VIEW public.v_property_inventory SET (security_invoker = on);

-- 4) Fix function search_path on refresh_bi_views
ALTER FUNCTION public.refresh_bi_views() SET search_path = public, pg_catalog;