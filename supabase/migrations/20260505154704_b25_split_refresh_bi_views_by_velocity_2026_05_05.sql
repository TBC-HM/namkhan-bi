-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505154704
-- Name:    b25_split_refresh_bi_views_by_velocity_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B25: Replace single refresh_bi_views() with two cadence-aware functions.
-- Rationale: Cloudbeds syncs every 30 min, so most matviews don't need 5-min refresh.
-- Splitting prevents one slow matview from starving the rest.

-- HOT tier: only "today" matviews (very small, very fast, refresh every 15 min)
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
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_today;
  EXCEPTION WHEN OTHERS THEN v_failures := array_append(v_failures, 'mv_kpi_today: '||SQLERRM);
  END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_arrivals_departures_today;
  EXCEPTION WHEN OTHERS THEN v_failures := array_append(v_failures, 'mv_arrivals_departures_today: '||SQLERRM);
  END;

  IF array_length(v_failures, 1) > 0 THEN
    RAISE WARNING 'refresh_bi_views_hot: % failures: %', array_length(v_failures,1), v_failures;
  END IF;
  
  RAISE NOTICE 'refresh_bi_views_hot completed in %', clock_timestamp() - v_start;
END;
$$;

-- WARM tier: all the rest of the Cloudbeds-derived matviews (refresh every 30 min, after Cloudbeds sync)
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
  -- Order matters: mv_classified_transactions before mv_revenue_by_usali_dept (downstream dep)
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
    EXCEPTION WHEN OTHERS THEN
      v_failures := array_append(v_failures, v_mv || ': ' || SQLERRM);
    END;
  END LOOP;

  IF array_length(v_failures, 1) > 0 THEN
    RAISE WARNING 'refresh_bi_views_warm: % failures: %', array_length(v_failures,1), v_failures;
  END IF;

  RAISE NOTICE 'refresh_bi_views_warm completed in %', clock_timestamp() - v_start;
END;
$$;

-- Unschedule the old job
SELECT cron.unschedule('refresh-bi-views-5min');

-- New schedules
SELECT cron.schedule(
  'refresh-bi-views-hot',
  '*/15 * * * *',
  $cron$ SELECT public.refresh_bi_views_hot(); $cron$
);

SELECT cron.schedule(
  'refresh-bi-views-warm',
  '8,38 * * * *',  -- runs at :08 and :38, after cb-sync at :00 and :30
  $cron$ SELECT public.refresh_bi_views_warm(); $cron$
);

-- Keep the old function for now (in case anything else calls it) but mark as deprecated
COMMENT ON FUNCTION public.refresh_bi_views() IS 'DEPRECATED 2026-05-05: replaced by refresh_bi_views_hot (15min) and refresh_bi_views_warm (30min, post-sync). Old function caused cascade failures on slow refreshes.';