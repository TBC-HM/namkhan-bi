-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505154948
-- Name:    b25b_add_analyze_to_refresh_functions_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Patch refresh functions to ANALYZE after refresh so freshness checker stays accurate.
-- (kpi.check_freshness uses pg_stat_all_tables.last_analyze as the proxy for "last refreshed".)

CREATE OR REPLACE FUNCTION public.refresh_bi_views_hot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_failures text[] := ARRAY[]::text[];
BEGIN
  BEGIN 
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_today;
    ANALYZE public.mv_kpi_today;
  EXCEPTION WHEN OTHERS THEN v_failures := array_append(v_failures, 'mv_kpi_today: '||SQLERRM);
  END;

  BEGIN 
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_arrivals_departures_today;
    ANALYZE public.mv_arrivals_departures_today;
  EXCEPTION WHEN OTHERS THEN v_failures := array_append(v_failures, 'mv_arrivals_departures_today: '||SQLERRM);
  END;

  IF array_length(v_failures, 1) > 0 THEN
    RAISE WARNING 'refresh_bi_views_hot: % failures: %', array_length(v_failures,1), v_failures;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_bi_views_warm()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_failures text[] := ARRAY[]::text[];
  v_mv text;
BEGIN
  FOREACH v_mv IN ARRAY ARRAY[
    'public.mv_classified_transactions',
    'public.mv_kpi_daily',
    'public.mv_kpi_daily_by_segment',
    'public.mv_pace_otb',
    'public.mv_rate_inventory_calendar',
    'public.mv_aged_ar',
    'public.mv_capture_rates',
    'public.mv_channel_perf',
    'public.mv_revenue_by_usali_dept',
    'public.mv_guest_profiles'
  ] LOOP
    BEGIN
      EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || v_mv;
      EXECUTE 'ANALYZE ' || v_mv;
    EXCEPTION WHEN OTHERS THEN
      v_failures := array_append(v_failures, v_mv || ': ' || SQLERRM);
    END;
  END LOOP;

  IF array_length(v_failures, 1) > 0 THEN
    RAISE WARNING 'refresh_bi_views_warm: % failures: %', array_length(v_failures,1), v_failures;
  END IF;
END;
$$;

-- Also patch the channel economics cron to ANALYZE
SELECT cron.unschedule('refresh-channel-economics-5min');
SELECT cron.schedule(
  'refresh-channel-economics-10min',
  '4,14,24,34,44,54 * * * *',
  $cron$
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_channel_economics;
    ANALYZE public.mv_channel_economics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_channel_x_roomtype;
    ANALYZE public.mv_channel_x_roomtype;
  $cron$
);