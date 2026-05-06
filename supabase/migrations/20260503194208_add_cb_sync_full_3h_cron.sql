-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503194208
-- Name:    add_cb_sync_full_3h_cron
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- 3-hourly Cloudbeds 'all'-scope sync. Same args as cron 32 (cb-sync-full-daily)
-- but 8x more frequent. Fires at 0,3,6,9,12,15,18,21 UTC.
-- Net effect: rate_inventory / room_types / rooms / rate_plans / market_segments /
-- item_categories / items / payment_methods / taxes_and_fees_config /
-- housekeeping_status / house_accounts / hotels / groups / add_ons get
-- refreshed every 3h instead of every 24h.
-- Cron 32 left active for redundancy at 02:00.
-- Cron 30 (reservations *_*/30) and cron 31 (transactions *_*/30) unchanged.
SELECT cron.schedule(
  'cb-sync-full-3h',
  '0 */3 * * *',
  $$ SELECT public.cb_invoke_sync('all', -90, 180, 8, 12); $$
);