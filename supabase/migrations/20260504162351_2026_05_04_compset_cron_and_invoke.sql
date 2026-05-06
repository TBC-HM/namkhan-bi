-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504162351
-- Name:    2026_05_04_compset_cron_and_invoke
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- 1. Helper: fire compset-agent-run EF (fire-and-forget, mirrors cb_invoke_sync pattern)
CREATE OR REPLACE FUNCTION public.compset_invoke_run(p_mode text DEFAULT 'phase_1_validation')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rid bigint;
  url text;
BEGIN
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL')
         || '/functions/v1/compset-agent-run';

  SELECT net.http_post(
    url := url,
    body := jsonb_build_object('mode', p_mode),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  ) INTO rid;

  RETURN rid;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compset_invoke_run(text) TO service_role;

COMMENT ON FUNCTION public.compset_invoke_run(text) IS
  'Fires compset-agent-run EF (fire-and-forget). EF returns 202 with run_id immediately, work continues via EdgeRuntime.waitUntil. Called by cron job 42.';

-- 2. Schedule daily compset shop at 06:00 ICT (23:00 UTC previous day)
SELECT cron.unschedule('compset-agent-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='compset-agent-daily'
);

SELECT cron.schedule(
  'compset-agent-daily',
  '0 23 * * *',
  $$ SELECT public.compset_invoke_run('phase_1_validation'); $$
);

-- 3. Flip cron_enabled in agent runtime_settings (UI surfaces this on Agent Settings)
UPDATE governance.agents
SET runtime_settings = runtime_settings || jsonb_build_object('cron_enabled', true)
WHERE code = 'compset_agent';

-- 4. Verify
SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname='compset-agent-daily';
