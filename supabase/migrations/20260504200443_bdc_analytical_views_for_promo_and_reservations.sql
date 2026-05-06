-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504200443
-- Name:    bdc_analytical_views_for_promo_and_reservations
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Promo ROI ranking: revenue $ / discount pp (rough lever return)
CREATE OR REPLACE VIEW public.v_bdc_promo_roi AS
SELECT
  promo_seq,
  name,
  status,
  discount_pct,
  bookable_from,
  bookable_to,
  bookings,
  room_nights,
  adr_usd,
  revenue_usd,
  canceled_room_nights,
  CASE WHEN COALESCE(bookings, 0) > 0
       THEN ROUND(revenue_usd / bookings, 2) ELSE NULL END                                AS revenue_per_booking,
  CASE WHEN COALESCE(room_nights, 0) > 0
       THEN ROUND(canceled_room_nights::numeric / room_nights * 100, 1) ELSE NULL END     AS cancel_rate_pct,
  CASE WHEN COALESCE(discount_pct, 0) > 0
       THEN ROUND(revenue_usd / discount_pct, 2) ELSE NULL END                            AS rev_per_discount_pp
FROM revenue.bdc_promotions
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM revenue.bdc_promotions)
ORDER BY revenue_usd DESC NULLS LAST;

-- Real 12-month country mix (ok bookings only)
CREATE OR REPLACE VIEW public.v_bdc_country_real_12m AS
WITH base AS (
  SELECT booker_country, status,
         price_usd, duration_nights, lead_days, adr_usd
  FROM revenue.bdc_reservations
  WHERE booker_country IS NOT NULL
)
SELECT
  booker_country                                                AS country_iso2,
  COUNT(*) FILTER (WHERE status='ok')                           AS bookings_ok,
  COUNT(*) FILTER (WHERE status='cancelled_by_guest')           AS bookings_cancelled,
  COUNT(*)                                                      AS bookings_total,
  ROUND(COUNT(*) FILTER (WHERE status='ok')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS confirm_rate_pct,
  ROUND(AVG(price_usd) FILTER (WHERE status='ok'), 2)           AS avg_price_usd,
  ROUND(AVG(adr_usd)   FILTER (WHERE status='ok'), 2)           AS avg_adr_usd,
  ROUND(AVG(duration_nights) FILTER (WHERE status='ok'), 2)     AS avg_los_nights,
  ROUND(AVG(lead_days) FILTER (WHERE status='ok'), 1)           AS avg_lead_days
FROM base
GROUP BY booker_country
ORDER BY bookings_ok DESC NULLS LAST;

-- Cancel cohort: by check-in month, % of cohort cancelled
CREATE OR REPLACE VIEW public.v_bdc_cancel_cohort_monthly AS
SELECT
  date_trunc('month', check_in)::date                                              AS check_in_month,
  COUNT(*)                                                                         AS bookings_total,
  COUNT(*) FILTER (WHERE status='ok')                                              AS bookings_ok,
  COUNT(*) FILTER (WHERE status='cancelled_by_guest')                              AS bookings_cancelled,
  ROUND(COUNT(*) FILTER (WHERE status='cancelled_by_guest')::numeric
        / NULLIF(COUNT(*), 0) * 100, 1)                                            AS cancel_pct,
  ROUND(SUM(price_usd) FILTER (WHERE status='ok'), 2)                              AS revenue_ok_usd,
  ROUND(SUM(price_usd) FILTER (WHERE status='cancelled_by_guest'), 2)              AS revenue_lost_usd
FROM revenue.bdc_reservations
WHERE check_in IS NOT NULL
GROUP BY check_in_month
ORDER BY check_in_month;

-- Device mix
CREATE OR REPLACE VIEW public.v_bdc_device_mix AS
SELECT
  COALESCE(NULLIF(device,''), '—')                                                 AS device,
  COUNT(*)                                                                         AS bookings_total,
  COUNT(*) FILTER (WHERE status='ok')                                              AS bookings_ok,
  COUNT(*) FILTER (WHERE status='cancelled_by_guest')                              AS bookings_cancelled,
  ROUND(COUNT(*) FILTER (WHERE status='ok')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS confirm_rate_pct,
  ROUND(AVG(adr_usd) FILTER (WHERE status='ok'), 2)                                AS avg_adr_usd,
  ROUND(AVG(lead_days) FILTER (WHERE status='ok'), 1)                              AS avg_lead_days
FROM revenue.bdc_reservations
GROUP BY 1
ORDER BY bookings_total DESC;

-- Travel purpose mix
CREATE OR REPLACE VIEW public.v_bdc_purpose_mix AS
SELECT
  COALESCE(NULLIF(travel_purpose,''), 'Unspecified')                               AS purpose,
  COUNT(*)                                                                         AS bookings_total,
  COUNT(*) FILTER (WHERE status='ok')                                              AS bookings_ok,
  ROUND(AVG(adr_usd) FILTER (WHERE status='ok'), 2)                                AS avg_adr_usd,
  ROUND(AVG(duration_nights) FILTER (WHERE status='ok'), 2)                        AS avg_los_nights
FROM revenue.bdc_reservations
GROUP BY 1
ORDER BY bookings_total DESC;

-- Lead time bucket distribution (for action targeting on cancel hotspots)
CREATE OR REPLACE VIEW public.v_bdc_lead_time_buckets AS
WITH bucket AS (
  SELECT CASE
    WHEN lead_days IS NULL THEN '—'
    WHEN lead_days <= 1 THEN '0-1 day'
    WHEN lead_days <= 3 THEN '2-3 days'
    WHEN lead_days <= 7 THEN '4-7 days'
    WHEN lead_days <= 14 THEN '8-14 days'
    WHEN lead_days <= 30 THEN '15-30 days'
    WHEN lead_days <= 60 THEN '31-60 days'
    WHEN lead_days <= 90 THEN '61-90 days'
    ELSE '91+ days'
  END AS window_label,
  CASE
    WHEN lead_days IS NULL THEN 9999
    WHEN lead_days <= 1 THEN 0
    WHEN lead_days <= 3 THEN 2
    WHEN lead_days <= 7 THEN 4
    WHEN lead_days <= 14 THEN 8
    WHEN lead_days <= 30 THEN 15
    WHEN lead_days <= 60 THEN 31
    WHEN lead_days <= 90 THEN 61
    ELSE 91
  END AS sort_min,
  status, adr_usd
  FROM revenue.bdc_reservations
)
SELECT
  window_label, sort_min,
  COUNT(*) AS bookings_total,
  COUNT(*) FILTER (WHERE status='ok') AS bookings_ok,
  COUNT(*) FILTER (WHERE status='cancelled_by_guest') AS bookings_cancelled,
  ROUND(COUNT(*) FILTER (WHERE status='cancelled_by_guest')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS cancel_pct,
  ROUND(AVG(adr_usd) FILTER (WHERE status='ok'), 2) AS avg_adr_usd
FROM bucket
GROUP BY window_label, sort_min
ORDER BY sort_min;

GRANT SELECT ON
  public.v_bdc_promo_roi,
  public.v_bdc_country_real_12m,
  public.v_bdc_cancel_cohort_monthly,
  public.v_bdc_device_mix,
  public.v_bdc_purpose_mix,
  public.v_bdc_lead_time_buckets
TO authenticated, anon, service_role;