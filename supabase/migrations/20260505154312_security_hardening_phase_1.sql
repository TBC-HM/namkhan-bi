-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505154312
-- Name:    security_hardening_phase_1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- SECURITY HARDENING PHASE 1
-- =====================================================================

-- 1. docs_data_query: service_role only
REVOKE EXECUTE ON FUNCTION public.docs_data_query(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.docs_data_query(text) TO service_role;

-- 2a. Mutating / admin functions -> service_role only (revoke from anon + authenticated)
REVOKE EXECUTE ON FUNCTION public.compset_activate_scoring_config(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compset_create_scoring_config_draft(numeric, numeric, numeric, numeric, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compset_invoke_run(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compset_run_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compset_run_finish(uuid, text, jsonb, integer, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compset_log_rate(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compset_log_rate_plan(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compset_update_agent_runtime(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_set_channel_contact(text, text, text, text, text, text, text, text, text, text, text, numeric, date, date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_set_room_type_budget(integer, integer, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_capture_otb_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_derive_add_ons(interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_derive_adjustments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_derive_all_extras() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_derive_guests() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_derive_sources() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_derive_tax_fee_records(interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parity_check_internal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.poster_reconcile_run() FROM PUBLIC, anon, authenticated;

-- 2b. Read-only RPCs: revoke anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.compset_get_jobs(uuid[], boolean, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compset_pick_scrape_dates(integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compset_run_progress(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_channel_daily_for_range(text, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_channel_econ_for_range(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_channel_mix_categorized_for_range(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_channel_mix_weekly_trend(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_channel_net_value_for_range(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_channel_pickup_for_source(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_channel_room_mix_for_range(text, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_channel_velocity_28d_by_cat() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_overview_kpis(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_pace_stly_snapshot(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.f_room_type_budget_occupancy(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.poster_by_method(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.poster_period_totals(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.poster_recent(date, date, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.poster_reconcile_summary(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.poster_report_findings() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.poster_top_bucket(text, date, date, integer) FROM PUBLIC, anon;

-- 3. Flip SECURITY DEFINER views to SECURITY INVOKER
ALTER VIEW public.v_decisions_booking_com    SET (security_invoker = true);
ALTER VIEW public.v_knowledge_overview       SET (security_invoker = true);
ALTER VIEW public.v_alerts_open              SET (security_invoker = true);
ALTER VIEW public.v_compset_agent_settings   SET (security_invoker = true);
ALTER VIEW public.v_dmc_reservation_mapping  SET (security_invoker = true);
ALTER VIEW public.v_decisions_queued_top     SET (security_invoker = true);
ALTER VIEW public.v_dmc_contracts            SET (security_invoker = true);

-- 4. Materialized views: revoke anon
REVOKE SELECT ON public.mv_classified_transactions    FROM anon;
REVOKE SELECT ON public.mv_guest_profiles             FROM anon;
REVOKE SELECT ON public.mv_kpi_today                  FROM anon;
REVOKE SELECT ON public.mv_channel_economics          FROM anon;
REVOKE SELECT ON public.mv_channel_x_roomtype         FROM anon;
REVOKE SELECT ON public.mv_kpi_daily_by_segment       FROM anon;
REVOKE SELECT ON public.mv_revenue_by_usali_dept      FROM anon;
REVOKE SELECT ON public.mv_rate_inventory_calendar    FROM anon;
REVOKE SELECT ON public.mv_channel_perf               FROM anon;
REVOKE SELECT ON public.mv_arrivals_departures_today  FROM anon;
REVOKE SELECT ON public.mv_kpi_daily                  FROM anon;
REVOKE SELECT ON public.mv_aged_ar                    FROM anon;
REVOKE SELECT ON public.mv_capture_rates              FROM anon;
REVOKE SELECT ON public.mv_pace_otb                   FROM anon;

-- PII-bearing MVs: also revoke from authenticated
REVOKE SELECT ON public.mv_guest_profiles             FROM authenticated;
REVOKE SELECT ON public.mv_aged_ar                    FROM authenticated;

-- 5. Storage buckets: drop listing-enabling SELECT policies
DROP POLICY IF EXISTS media_renders_read       ON storage.objects;
DROP POLICY IF EXISTS staff_photos_public_read ON storage.objects;

-- 6. Drop the stray backup table
DROP TABLE IF EXISTS public.reservation_rooms_backup_20260503;

-- 7. Move movable extensions out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION citext    SET SCHEMA extensions;
ALTER EXTENSION pg_trgm   SET SCHEMA extensions;
ALTER EXTENSION btree_gin SET SCHEMA extensions;
