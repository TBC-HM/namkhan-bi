-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506004037
-- Name:    fix_bdc_pace_alias_and_kpi_daily_grant
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- 1. Add stay_year_month text alias to v_bdc_pace_monthly so existing JS readers keep working.
DROP VIEW IF EXISTS public.v_bdc_pace_monthly CASCADE;
CREATE VIEW public.v_bdc_pace_monthly AS
SELECT
  upload_id, snapshot_date, stay_month,
  to_char(stay_month, 'YYYY-MM')          AS stay_year_month,
  rn_current, rn_last_year, rn_diff_pct,
  revenue_current_usd, revenue_last_year_usd, revenue_diff_pct,
  adr_current_usd, adr_last_year_usd, adr_diff_pct,
  loaded_at
FROM revenue.bdc_pace_monthly_v2
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM revenue.bdc_pace_monthly_v2)
ORDER BY stay_month;
GRANT SELECT ON public.v_bdc_pace_monthly TO authenticated, anon, service_role;

-- Same fix for genius (period_month is now date, but JS code may expect text)
DROP VIEW IF EXISTS public.v_bdc_genius_monthly CASCADE;
CREATE VIEW public.v_bdc_genius_monthly AS
SELECT
  upload_id, snapshot_date,
  period_month,
  to_char(period_month, 'YYYY-MM')        AS period_month_text,
  bookings, bookings_last_year,
  rn_total, rn_last_year, revenue_usd, revenue_last_year_usd,
  adr_usd, adr_last_year_usd, cancel_pct, cancel_pct_last_year,
  genius_pct, genius_pct_last_year, loaded_at
FROM revenue.bdc_genius_monthly_v2
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM revenue.bdc_genius_monthly_v2)
ORDER BY period_month;
GRANT SELECT ON public.v_bdc_genius_monthly TO authenticated, anon, service_role;

-- 2. Grant SELECT on mv_kpi_daily to anon/authenticated so v_bdc_hero_channel_share JOIN works.
GRANT SELECT ON public.mv_kpi_daily TO authenticated, anon;