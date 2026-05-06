-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502135329
-- Name:    wire_cron_to_edge_function_30min
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- Replace the broken in-database sync with Edge Function invocation.
--
-- Why: pg_net snapshot isolation prevents PL/pgSQL from polling Cloudbeds
-- responses reliably. Edge Functions (Deno) handle HTTP correctly.
-- The 'sync-cloudbeds' Edge Function is already deployed (v11) and
-- works — verified: 600 reservations upserted in 58s, status=success.
-- =====================================================================

-- 1. Drop the old hourly cron and the broken cb_hourly_refresh wrapper
DO $$
DECLARE jid bigint;
BEGIN
  -- Unschedule the hourly job that called the broken in-DB sync
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'hourly-refresh';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;

  -- Unschedule the daily-cold-sync (also calls broken function)
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'daily-cold-sync';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;

  -- Unschedule monthly-close-prep (also calls broken cb_hourly_refresh)
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'monthly-close-prep';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

-- 2. Helper that invokes the Edge Function with a given scope
CREATE OR REPLACE FUNCTION public.cb_invoke_sync(
  p_scope text DEFAULT 'reservations',
  p_from_offset_days int DEFAULT -7,
  p_to_offset_days   int DEFAULT 90,
  p_max_pages        int DEFAULT 6,
  p_tx_max_pages     int DEFAULT 10
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  rid bigint;
  url text;
BEGIN
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL')
         || '/functions/v1/sync-cloudbeds';

  SELECT net.http_post(
    url := url,
    body := jsonb_build_object(
      'scope', p_scope,
      'fromDate', (CURRENT_DATE + p_from_offset_days)::text,
      'toDate',   (CURRENT_DATE + p_to_offset_days)::text,
      'maxPages', p_max_pages,
      'txMaxPages', p_tx_max_pages
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 240000
  ) INTO rid;

  -- Note: we do NOT poll for the response. The Edge Function writes its
  -- own sync_runs entry. pg_net's snapshot isolation makes polling
  -- unreliable from within a function. Fire-and-forget is correct here.
  RETURN rid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cb_invoke_sync(text,int,int,int,int)
  TO authenticated, service_role, postgres;

-- 3. Schedule reservation sync every 30 minutes (push window: 7d back, 90d forward)
SELECT cron.schedule(
  'cb-sync-reservations-30min',
  '*/30 * * * *',
  $$ SELECT public.cb_invoke_sync('reservations', -7, 90, 6, 6); $$
);

-- 4. Schedule transaction sync every 30 min, offset by 5 min to avoid overlap
SELECT cron.schedule(
  'cb-sync-transactions-30min',
  '5,35 * * * *',
  $$ SELECT public.cb_invoke_sync('transactions', -7, 1, 1, 10); $$
);

-- 5. Schedule a daily full sync at 02:00 UTC for cold tables (rooms, room_types,
--    rate_inventory, items, taxes, etc.) — wider window
SELECT cron.schedule(
  'cb-sync-full-daily',
  '0 2 * * *',
  $$ SELECT public.cb_invoke_sync('all', -90, 180, 8, 12); $$
);

-- 6. Recompute daily_metrics every 30 min (uses fixed UPSERT version)
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'recompute-daily-metrics-30min';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
SELECT cron.schedule(
  'recompute-daily-metrics-30min',
  '15,45 * * * *',
  $$ SELECT public.recompute_daily_metrics(260955, (CURRENT_DATE - 60)::date, (CURRENT_DATE + 365)::date); $$
);

-- 7. Manual trigger function (for owner to invoke from UI / SQL editor)
CREATE OR REPLACE FUNCTION public.cb_sync_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  rid_res bigint;
  rid_tx  bigint;
BEGIN
  rid_res := public.cb_invoke_sync('reservations', -7, 90, 6, 6);
  rid_tx  := public.cb_invoke_sync('transactions', -7, 1, 1, 10);
  PERFORM public.recompute_daily_metrics(260955, (CURRENT_DATE - 60)::date, (CURRENT_DATE + 365)::date);
  RETURN jsonb_build_object(
    'reservations_request_id', rid_res,
    'transactions_request_id', rid_tx,
    'message', 'Edge function invoked. Check sync_runs in ~60s.'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.cb_sync_now() TO authenticated, service_role;
