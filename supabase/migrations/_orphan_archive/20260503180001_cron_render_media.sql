-- Cron job: render-media every 1 minute
-- APPLIED 2026-05-03 via Supabase MCP. Job ID 38.
-- Purpose: drain marketing.media_assets status='ingested' queue by calling the
--          render-media Edge Function which generates 5 sized renders + flips
--          status to 'ready'.
-- Note: function is verify_jwt=false, called without Authorization header.

DO $$ BEGIN
  PERFORM cron.unschedule('render-media');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'render-media',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://kpenyneooigsyuuomgct.supabase.co/functions/v1/render-media',
    headers:='{"content-type":"application/json"}'::jsonb,
    timeout_milliseconds:=45000
  );$$
);
