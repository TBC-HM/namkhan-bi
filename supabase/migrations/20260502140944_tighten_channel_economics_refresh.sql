-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502140944
-- Name:    tighten_channel_economics_refresh
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Channel economics views need to refresh after each sync (windows are CURRENT_DATE-relative).
-- Currently scheduled daily at 02:15 — too slow. Move to every 5 min.
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'refresh-channel-economics';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'refresh-channel-economics-5min',
  '2,12,22,32,42,52 * * * *', -- every 10min, offset 2min from BI views
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_channel_economics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_channel_x_roomtype;
  $$
);
