-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502140626
-- Name:    tighten_bi_view_refresh_to_5min
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Refresh BI views every 5 minutes (was 15) so dashboard updates lag at most 5 min behind sync.
-- The reservation sync runs at :00 and :30; transactions at :05 and :35; daily_metrics at :15 and :45.
-- BI views refreshing every 5 minutes will pick up changes within the same hour.

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'refresh_bi_views_15min';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'refresh-bi-views-5min',
  '*/5 * * * *',
  $$ SELECT public.refresh_bi_views(); $$
);

-- Also: make recompute_daily_metrics fire 5 minutes after each reservation sync
-- (was 15/45; now sync :00,:30 → metrics :05,:35 → bi :10,:40 → ready by :11,:41)
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'recompute-daily-metrics-30min';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'recompute-daily-metrics-30min',
  '7,37 * * * *',
  $$ SELECT public.recompute_daily_metrics(260955, (CURRENT_DATE - 60)::date, (CURRENT_DATE + 365)::date); $$
);
