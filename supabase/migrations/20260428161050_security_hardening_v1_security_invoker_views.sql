-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428161050
-- Name:    security_hardening_v1_security_invoker_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- Security hardening v1
-- =============================================================================
-- Fix 1: Convert all SECURITY DEFINER views to SECURITY INVOKER.
-- These views were created as SECURITY DEFINER (default in older Supabase),
-- which bypasses RLS. Switch them to SECURITY INVOKER so they respect the
-- caller's permissions.
-- These v_* views are legacy from pre-Phase-1; they are NOT used by the
-- dashboard (which reads mv_* materialized views). Safe to alter.
-- =============================================================================

ALTER VIEW public.v_room_type_perf       SET (security_invoker = on);
ALTER VIEW public.v_kpi_daily            SET (security_invoker = on);
ALTER VIEW public.v_cancellation_rate    SET (security_invoker = on);
ALTER VIEW public.v_country_mix          SET (security_invoker = on);
ALTER VIEW public.v_lead_time            SET (security_invoker = on);
ALTER VIEW public.v_otb_pace             SET (security_invoker = on);
ALTER VIEW public.v_repeat_guests        SET (security_invoker = on);
ALTER VIEW public.v_channel_summary      SET (security_invoker = on);
ALTER VIEW public.v_pickup_30d           SET (security_invoker = on);
ALTER VIEW public.v_arrivals_today       SET (security_invoker = on);
ALTER VIEW public.v_inhouse              SET (security_invoker = on);
ALTER VIEW public.v_departures_today     SET (security_invoker = on);
ALTER VIEW public.v_revenue_usali        SET (security_invoker = on);
ALTER VIEW public.v_channel_mix          SET (security_invoker = on);
ALTER VIEW public.v_country_mix_30d      SET (security_invoker = on);
ALTER VIEW public.v_lead_time_buckets    SET (security_invoker = on);
ALTER VIEW public.v_alos_30d             SET (security_invoker = on);
ALTER VIEW public.v_last_7_days          SET (security_invoker = on);
ALTER VIEW public.v_channel_mix_30d      SET (security_invoker = on);

-- Note: v_property_inventory and v_classified_transactions were created in
-- our Phase 1 migrations as regular views (no SECURITY DEFINER), so no fix needed.