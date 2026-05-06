-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428161214
-- Name:    security_hardening_v3_function_search_paths
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_auth_header() SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_collect(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_drain_step(text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_fire_batch(text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_get(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_hourly_refresh() SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_plan_pages(text, text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_process_reservations() SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_process_transactions() SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_retry_failed(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_run_waves(text, integer, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.cb_sync_recent_reservations() SET search_path = public, pg_temp;
ALTER FUNCTION public.recompute_daily_metrics(bigint, date, date) SET search_path = public, pg_temp;