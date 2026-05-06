-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504211439
-- Name:    bdc_hero_views_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW public.v_bdc_hero_channel_share AS
WITH bdc AS (
  SELECT
    COUNT(*) FILTER (WHERE status='ok')                       AS bdc_bookings,
    SUM(duration_nights) FILTER (WHERE status='ok')           AS bdc_room_nights,
    SUM(price_usd) FILTER (WHERE status='ok')                 AS bdc_revenue_usd,
    AVG(adr_usd) FILTER (WHERE status='ok')                   AS bdc_adr_usd,
    MIN(check_in)                                             AS period_from,
    MAX(check_in)                                             AS period_to
  FROM revenue.bdc_reservations
),
hotel AS (
  SELECT
    SUM(rooms_sold)                                           AS hotel_room_nights,
    SUM(rooms_revenue)                                        AS hotel_revenue_usd,
    CASE WHEN SUM(rooms_sold) > 0
         THEN SUM(rooms_revenue) / SUM(rooms_sold) ELSE NULL END AS hotel_adr_usd
  FROM mv_kpi_daily k, bdc b
  WHERE k.night_date BETWEEN b.period_from AND b.period_to
)
SELECT
  bdc.period_from, bdc.period_to,
  bdc.bdc_bookings, bdc.bdc_room_nights, bdc.bdc_revenue_usd, bdc.bdc_adr_usd,
  hotel.hotel_room_nights, hotel.hotel_revenue_usd, hotel.hotel_adr_usd,
  CASE WHEN hotel.hotel_room_nights > 0
       THEN ROUND(bdc.bdc_room_nights::numeric / hotel.hotel_room_nights * 100, 1)
       ELSE NULL END                                          AS bdc_rn_share_pct,
  CASE WHEN hotel.hotel_revenue_usd > 0
       THEN ROUND(bdc.bdc_revenue_usd::numeric / hotel.hotel_revenue_usd * 100, 1)
       ELSE NULL END                                          AS bdc_revenue_share_pct,
  CASE WHEN hotel.hotel_adr_usd > 0 AND bdc.bdc_adr_usd IS NOT NULL
       THEN ROUND((bdc.bdc_adr_usd / hotel.hotel_adr_usd - 1) * 100, 1)
       ELSE NULL END                                          AS bdc_adr_premium_pct
FROM bdc, hotel;

CREATE OR REPLACE VIEW public.v_bdc_hero_funnel AS
SELECT
  COUNT(*)                                                    AS attempts,
  COUNT(*) FILTER (WHERE status='ok')                         AS confirmed,
  COUNT(*) FILTER (WHERE status='cancelled_by_guest')         AS cancelled_guest,
  COUNT(*) FILTER (WHERE status='cancelled_by_hotel')         AS cancelled_hotel,
  COUNT(*) FILTER (WHERE status='no_show')                    AS no_show,
  ROUND(SUM(price_usd) FILTER (WHERE status='ok'), 0)         AS realized_revenue_usd,
  ROUND(SUM(price_usd), 0)                                    AS gross_attempted_revenue_usd,
  ROUND(SUM(price_usd) FILTER (WHERE status<>'ok'), 0)        AS leaked_revenue_usd,
  ROUND(SUM(price_usd) FILTER (WHERE status='ok')::numeric
        / NULLIF(SUM(price_usd), 0) * 100, 1)                 AS realization_rate_pct
FROM revenue.bdc_reservations;

CREATE OR REPLACE VIEW public.v_bdc_hero_12m_trajectory AS
WITH monthly AS (
  SELECT
    date_trunc('month', check_in)::date                                  AS month,
    COUNT(*)                                                              AS bookings_total,
    COUNT(*) FILTER (WHERE status='ok')                                   AS bookings_ok,
    SUM(price_usd) FILTER (WHERE status='ok')                             AS revenue_ok_usd,
    AVG(adr_usd) FILTER (WHERE status='ok')                               AS avg_adr_usd,
    ROUND(COUNT(*) FILTER (WHERE status='cancelled_by_guest')::numeric
          / NULLIF(COUNT(*), 0) * 100, 1)                                 AS cancel_pct
  FROM revenue.bdc_reservations
  WHERE check_in IS NOT NULL
  GROUP BY 1
)
SELECT m.*,
  CASE WHEN m.month < (SELECT MIN(month) + INTERVAL '6 months' FROM monthly)
       THEN 'H1' ELSE 'H2' END                                            AS half
FROM monthly m
ORDER BY m.month;

GRANT SELECT ON public.v_bdc_hero_channel_share, public.v_bdc_hero_funnel, public.v_bdc_hero_12m_trajectory
  TO authenticated, anon, service_role;