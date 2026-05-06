-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427173924
-- Name:    analytics_views_v2_fixed
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE VIEW v_kpi_daily AS
SELECT 
  metric_date,
  rooms_available,
  rooms_sold,
  occupancy_pct,
  adr,
  revpar,
  rooms_revenue,
  fb_revenue,
  other_revenue,
  total_revenue,
  arrivals,
  departures,
  cancellations,
  no_shows,
  is_actual,
  CASE WHEN metric_date < CURRENT_DATE THEN 'Actual' 
       WHEN metric_date = CURRENT_DATE THEN 'Today' 
       ELSE 'OTB' END AS bucket,
  EXTRACT(YEAR FROM metric_date)::int AS year,
  EXTRACT(MONTH FROM metric_date)::int AS month,
  TO_CHAR(metric_date, 'YYYY-MM') AS year_month,
  EXTRACT(DOW FROM metric_date)::int AS dow
FROM daily_metrics
WHERE property_id = 260955;

CREATE OR REPLACE VIEW v_pickup_30d AS
WITH dates AS (
  SELECT generate_series(CURRENT_DATE, CURRENT_DATE + 90, '1 day'::interval)::date AS sd
)
SELECT 
  d.sd AS stay_date,
  (SELECT COUNT(DISTINCT rr.reservation_id || '|' || COALESCE(rr.room_id,''))
   FROM reservation_rooms rr
   JOIN reservations r ON r.reservation_id = rr.reservation_id
   WHERE rr.night_date = d.sd AND NOT r.is_cancelled) AS otb_rooms,
  (SELECT COUNT(DISTINCT rr.reservation_id || '|' || COALESCE(rr.room_id,''))
   FROM reservation_rooms rr
   JOIN reservations r ON r.reservation_id = rr.reservation_id
   WHERE rr.night_date = d.sd AND NOT r.is_cancelled
     AND r.booking_date::date <= CURRENT_DATE - 7) AS otb_rooms_7d_ago,
  (SELECT COUNT(DISTINCT rr.reservation_id || '|' || COALESCE(rr.room_id,''))
   FROM reservation_rooms rr
   JOIN reservations r ON r.reservation_id = rr.reservation_id
   WHERE rr.night_date = d.sd AND NOT r.is_cancelled
     AND r.booking_date::date <= CURRENT_DATE - 30) AS otb_rooms_30d_ago
FROM dates d;

CREATE OR REPLACE VIEW v_revenue_usali AS
SELECT 
  service_date,
  usali_dept,
  usali_subdept,
  COUNT(*) AS tx_count,
  SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) AS revenue_gross,
  SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) AS payments_received
FROM transactions
WHERE service_date IS NOT NULL AND usali_dept IS NOT NULL
  AND usali_dept NOT IN ('Tax','Fee')
GROUP BY service_date, usali_dept, usali_subdept;

CREATE OR REPLACE VIEW v_channel_mix AS
WITH last90 AS (
  SELECT r.source_name, rr.rate, rr.night_date,
         CASE 
           WHEN s.category = 'OTA' THEN 'OTA'
           WHEN r.source_name IN ('Walk-In','Direct','Email','Website/Booking Engine','Phone') THEN 'Direct'
           WHEN r.source_name ILIKE '%travel%' OR r.source_name ILIKE '%tour%' THEN 'Wholesale/Tour'
           ELSE 'Other'
         END AS channel_group
  FROM reservation_rooms rr
  JOIN reservations r ON r.reservation_id = rr.reservation_id
  LEFT JOIN sources s ON s.name = r.source_name
  WHERE NOT r.is_cancelled 
    AND rr.night_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 1
)
SELECT 
  channel_group,
  COALESCE(source_name,'(blank)') AS source_name,
  COUNT(*) AS room_nights,
  ROUND(SUM(rate)::numeric, 0) AS revenue,
  ROUND(AVG(rate)::numeric, 0) AS avg_adr
FROM last90
GROUP BY channel_group, source_name;

CREATE OR REPLACE VIEW v_country_mix AS
SELECT 
  COALESCE(NULLIF(guest_country,''), 'UNKNOWN') AS country,
  COUNT(*) AS bookings,
  COUNT(*) FILTER (WHERE NOT is_cancelled) AS confirmed,
  ROUND(SUM(total_amount) FILTER (WHERE NOT is_cancelled)::numeric, 0) AS revenue
FROM reservations
WHERE check_in_date >= CURRENT_DATE - 365
GROUP BY country
ORDER BY confirmed DESC;

CREATE OR REPLACE VIEW v_lead_time AS
SELECT 
  CASE 
    WHEN check_in_date - booking_date::date <= 7 THEN '0-7 days'
    WHEN check_in_date - booking_date::date <= 30 THEN '8-30 days'
    WHEN check_in_date - booking_date::date <= 90 THEN '31-90 days'
    WHEN check_in_date - booking_date::date <= 180 THEN '91-180 days'
    ELSE '180+ days'
  END AS lead_bucket,
  COUNT(*) AS bookings,
  ROUND(AVG(check_in_date - booking_date::date)::numeric, 0) AS avg_lead_days
FROM reservations
WHERE NOT is_cancelled
  AND check_in_date >= CURRENT_DATE - 365
  AND booking_date IS NOT NULL
GROUP BY 1;

CREATE OR REPLACE VIEW v_room_type_perf AS
SELECT 
  rt.room_type_name,
  rt.quantity AS rooms,
  COUNT(rr.id) FILTER (WHERE rr.night_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 1) AS room_nights_sold_90d,
  ROUND(AVG(rr.rate) FILTER (WHERE rr.night_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 1)::numeric, 0) AS avg_rate_90d,
  ROUND(SUM(rr.rate) FILTER (WHERE rr.night_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 1)::numeric, 0) AS revenue_90d,
  COUNT(rr.id) FILTER (WHERE rr.night_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90) AS otb_room_nights_next_90d,
  ROUND(SUM(rr.rate) FILTER (WHERE rr.night_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90)::numeric, 0) AS otb_revenue_next_90d
FROM room_types rt
LEFT JOIN reservation_rooms rr ON rr.room_type_id = rt.room_type_id
LEFT JOIN reservations r ON r.reservation_id = rr.reservation_id AND NOT r.is_cancelled
GROUP BY rt.room_type_id, rt.room_type_name, rt.quantity
ORDER BY revenue_90d DESC NULLS LAST;

CREATE OR REPLACE VIEW v_arrivals_today AS
SELECT reservation_id, guest_name, guest_country, room_type_name, source_name, 
       nights, total_amount, status, adults, children
FROM reservations
WHERE check_in_date = CURRENT_DATE AND NOT is_cancelled;

CREATE OR REPLACE VIEW v_departures_today AS
SELECT reservation_id, guest_name, guest_country, room_type_name, source_name, 
       nights, total_amount, balance, status
FROM reservations
WHERE check_out_date = CURRENT_DATE AND NOT is_cancelled;

CREATE OR REPLACE VIEW v_inhouse AS
SELECT reservation_id, guest_name, guest_country, room_type_name, source_name,
       check_in_date, check_out_date, total_amount, balance
FROM reservations
WHERE NOT is_cancelled 
  AND check_in_date <= CURRENT_DATE 
  AND check_out_date > CURRENT_DATE
  AND status IN ('checked_in','confirmed');
