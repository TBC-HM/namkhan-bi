-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428144134
-- Name:    create_bi_materialized_views_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- BI Materialized Views v1
CREATE OR REPLACE VIEW v_property_inventory AS
SELECT property_id, COUNT(*)::int AS total_rooms
FROM rooms
WHERE is_active IS NOT FALSE
GROUP BY property_id;

DROP MATERIALIZED VIEW IF EXISTS mv_kpi_daily CASCADE;
CREATE MATERIALIZED VIEW mv_kpi_daily AS
WITH nightly AS (
  SELECT r.property_id, rr.night_date,
    COUNT(*) FILTER (WHERE r.status NOT IN ('canceled','no_show')) AS rooms_sold,
    COALESCE(SUM(rr.rate) FILTER (WHERE r.status NOT IN ('canceled','no_show')), 0) AS rooms_revenue
  FROM reservation_rooms rr JOIN reservations r ON r.reservation_id = rr.reservation_id
  GROUP BY r.property_id, rr.night_date
),
fnb AS (
  SELECT t.property_id, t.transaction_date::date AS night_date,
    COALESCE(SUM(t.amount) FILTER (WHERE t.category IN ('custom_item','product','addon')), 0) AS ancillary_revenue,
    COALESCE(SUM(t.amount) FILTER (WHERE t.category IN ('custom_item','product','addon') AND COALESCE(t.item_category_name,'') ILIKE ANY (ARRAY['%food%','%beverage%','%bar%','%restaurant%','%minibar%'])), 0) AS fnb_revenue,
    COALESCE(SUM(t.amount) FILTER (WHERE t.category IN ('custom_item','product','addon') AND COALESCE(t.item_category_name,'') ILIKE '%spa%'), 0) AS spa_revenue,
    COALESCE(SUM(t.amount) FILTER (WHERE t.category IN ('custom_item','product','addon') AND COALESCE(t.item_category_name,'') ILIKE ANY (ARRAY['%activit%','%excursion%','%tour%'])), 0) AS activity_revenue
  FROM transactions t WHERE t.transaction_date IS NOT NULL
  GROUP BY t.property_id, t.transaction_date::date
)
SELECT COALESCE(n.property_id, f.property_id) AS property_id,
  COALESCE(n.night_date, f.night_date) AS night_date,
  COALESCE(n.rooms_sold, 0) AS rooms_sold, inv.total_rooms,
  GREATEST(inv.total_rooms - COALESCE(n.rooms_sold, 0), 0) AS rooms_available,
  ROUND(100.0 * COALESCE(n.rooms_sold, 0) / NULLIF(inv.total_rooms, 0), 2) AS occupancy_pct,
  COALESCE(n.rooms_revenue, 0) AS rooms_revenue,
  ROUND(COALESCE(n.rooms_revenue, 0) / NULLIF(n.rooms_sold, 0), 2) AS adr,
  ROUND(COALESCE(n.rooms_revenue, 0) / NULLIF(inv.total_rooms, 0), 2) AS revpar,
  COALESCE(f.fnb_revenue, 0) AS fnb_revenue,
  COALESCE(f.spa_revenue, 0) AS spa_revenue,
  COALESCE(f.activity_revenue, 0) AS activity_revenue,
  COALESCE(f.ancillary_revenue, 0) AS total_ancillary_revenue,
  ROUND((COALESCE(n.rooms_revenue, 0) + COALESCE(f.ancillary_revenue, 0)) / NULLIF(inv.total_rooms, 0), 2) AS trevpar
FROM nightly n
FULL OUTER JOIN fnb f ON n.property_id = f.property_id AND n.night_date = f.night_date
LEFT JOIN v_property_inventory inv ON inv.property_id = COALESCE(n.property_id, f.property_id);
CREATE UNIQUE INDEX idx_mv_kpi_daily_pk ON mv_kpi_daily (property_id, night_date);
CREATE INDEX idx_mv_kpi_daily_date ON mv_kpi_daily (night_date);

DROP MATERIALIZED VIEW IF EXISTS mv_kpi_today CASCADE;
CREATE MATERIALIZED VIEW mv_kpi_today AS
SELECT inv.property_id, CURRENT_DATE AS as_of, inv.total_rooms,
  (SELECT COUNT(*) FROM reservations r WHERE r.property_id = inv.property_id AND r.status = 'checked_in' AND r.check_in_date <= CURRENT_DATE AND r.check_out_date > CURRENT_DATE) AS in_house,
  (SELECT COUNT(*) FROM reservations r WHERE r.property_id = inv.property_id AND r.check_in_date = CURRENT_DATE AND r.status NOT IN ('canceled','no_show')) AS arrivals_today,
  (SELECT COUNT(*) FROM reservations r WHERE r.property_id = inv.property_id AND r.check_out_date = CURRENT_DATE AND r.status NOT IN ('canceled','no_show')) AS departures_today,
  (SELECT COUNT(*) FROM reservations r WHERE r.property_id = inv.property_id AND r.check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90 AND r.status NOT IN ('canceled','no_show')) AS otb_next_90d,
  (SELECT COUNT(DISTINCT r.reservation_id) FROM reservations r JOIN reservation_rooms rr ON rr.reservation_id = r.reservation_id WHERE r.property_id = inv.property_id AND rr.night_date = CURRENT_DATE AND r.status NOT IN ('canceled','no_show')) AS occupied_tonight,
  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE r.status='canceled') / NULLIF(COUNT(*),0), 2) FROM reservations r WHERE r.property_id = inv.property_id AND r.booking_date >= CURRENT_DATE - 90) AS cancellation_pct_90d,
  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE r.status='no_show') / NULLIF(COUNT(*) FILTER (WHERE r.status NOT IN ('canceled')), 0), 2) FROM reservations r WHERE r.property_id = inv.property_id AND r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE) AS no_show_pct_90d
FROM v_property_inventory inv;
CREATE UNIQUE INDEX idx_mv_kpi_today_pk ON mv_kpi_today (property_id);

DROP MATERIALIZED VIEW IF EXISTS mv_revenue_by_usali_dept CASCADE;
CREATE MATERIALIZED VIEW mv_revenue_by_usali_dept AS
WITH room_rev AS (
  SELECT r.property_id, DATE_TRUNC('month', rr.night_date)::date AS month, 'Rooms' AS usali_dept,
         SUM(rr.rate) AS revenue, COUNT(*) AS units
  FROM reservation_rooms rr JOIN reservations r ON r.reservation_id = rr.reservation_id
  WHERE r.status NOT IN ('canceled','no_show')
  GROUP BY r.property_id, DATE_TRUNC('month', rr.night_date)
),
ancillary AS (
  SELECT t.property_id, DATE_TRUNC('month', t.transaction_date)::date AS month,
    CASE
      WHEN t.item_category_name ILIKE ANY (ARRAY['%food%','%restaurant%','%minibar%']) THEN 'F&B - Food'
      WHEN t.item_category_name ILIKE ANY (ARRAY['%beverage%','%bar%','%wine%','%drink%']) THEN 'F&B - Beverage'
      WHEN t.item_category_name ILIKE '%spa%' THEN 'Spa'
      WHEN t.item_category_name ILIKE ANY (ARRAY['%activit%','%excursion%','%tour%']) THEN 'Activities'
      WHEN t.item_category_name ILIKE ANY (ARRAY['%transport%','%shuttle%','%transfer%']) THEN 'Transportation'
      ELSE 'Other Operated'
    END AS usali_dept,
    SUM(t.amount) AS revenue, COUNT(*) AS units
  FROM transactions t
  WHERE t.category IN ('custom_item','product','addon') AND t.transaction_date IS NOT NULL
  GROUP BY 1, 2, 3
)
SELECT property_id, month, usali_dept, SUM(revenue) AS revenue, SUM(units) AS units
FROM (SELECT * FROM room_rev UNION ALL SELECT * FROM ancillary) x
GROUP BY 1, 2, 3;
CREATE UNIQUE INDEX idx_mv_rev_usali_pk ON mv_revenue_by_usali_dept (property_id, month, usali_dept);

DROP MATERIALIZED VIEW IF EXISTS mv_channel_perf CASCADE;
CREATE MATERIALIZED VIEW mv_channel_perf AS
SELECT r.property_id, COALESCE(r.source_name, 'Unknown') AS source_name,
  COUNT(*) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE) AS bookings_30d,
  COALESCE(SUM(r.total_amount) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE AND r.status NOT IN ('canceled','no_show')), 0) AS revenue_30d,
  COUNT(*) FILTER (WHERE r.status='canceled' AND r.check_in_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE) AS canceled_30d,
  COUNT(*) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE) AS bookings_90d,
  COALESCE(SUM(r.total_amount) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE AND r.status NOT IN ('canceled','no_show')), 0) AS revenue_90d,
  COUNT(*) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 365 AND CURRENT_DATE) AS bookings_365d,
  COALESCE(SUM(r.total_amount) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 365 AND CURRENT_DATE AND r.status NOT IN ('canceled','no_show')), 0) AS revenue_365d,
  ROUND(SUM(r.total_amount) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE AND r.status NOT IN ('canceled','no_show'))
        / NULLIF(SUM(r.nights) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE AND r.status NOT IN ('canceled','no_show')), 0), 2) AS adr_90d,
  ROUND(AVG((r.check_in_date - r.booking_date::date)::numeric) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE AND r.status NOT IN ('canceled','no_show')), 1) AS avg_lead_time_90d,
  ROUND(AVG(r.nights) FILTER (WHERE r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE AND r.status NOT IN ('canceled','no_show')), 1) AS avg_los_90d
FROM reservations r
WHERE r.check_in_date >= CURRENT_DATE - 365
GROUP BY r.property_id, r.source_name;
CREATE UNIQUE INDEX idx_mv_channel_perf_pk ON mv_channel_perf (property_id, source_name);

DROP MATERIALIZED VIEW IF EXISTS mv_pace_otb CASCADE;
CREATE MATERIALIZED VIEW mv_pace_otb AS
WITH current_otb AS (
  SELECT r.property_id, DATE_TRUNC('month', rr.night_date)::date AS ci_month,
    COUNT(*) AS roomnights, SUM(rr.rate) AS revenue
  FROM reservation_rooms rr JOIN reservations r ON r.reservation_id = rr.reservation_id
  WHERE r.status NOT IN ('canceled','no_show')
  GROUP BY r.property_id, DATE_TRUNC('month', rr.night_date)
),
stly AS (
  SELECT r.property_id, (DATE_TRUNC('month', rr.night_date) + INTERVAL '12 months')::date AS ci_month_curr,
    COUNT(*) AS roomnights, SUM(rr.rate) AS revenue
  FROM reservation_rooms rr JOIN reservations r ON r.reservation_id = rr.reservation_id
  WHERE r.status NOT IN ('canceled','no_show')
    AND r.booking_date <= (CURRENT_DATE - INTERVAL '12 months')::timestamptz
    AND rr.night_date BETWEEN CURRENT_DATE - INTERVAL '12 months' AND CURRENT_DATE
  GROUP BY r.property_id, DATE_TRUNC('month', rr.night_date)
)
SELECT COALESCE(c.property_id, s.property_id) AS property_id,
  COALESCE(c.ci_month, s.ci_month_curr) AS ci_month,
  COALESCE(c.roomnights, 0) AS otb_roomnights, COALESCE(c.revenue, 0) AS otb_revenue,
  COALESCE(s.roomnights, 0) AS stly_roomnights, COALESCE(s.revenue, 0) AS stly_revenue,
  COALESCE(c.roomnights, 0) - COALESCE(s.roomnights, 0) AS roomnights_delta,
  COALESCE(c.revenue, 0) - COALESCE(s.revenue, 0) AS revenue_delta
FROM current_otb c
FULL OUTER JOIN stly s ON c.property_id = s.property_id AND c.ci_month = s.ci_month_curr
WHERE COALESCE(c.ci_month, s.ci_month_curr) >= DATE_TRUNC('month', CURRENT_DATE)::date;
CREATE UNIQUE INDEX idx_mv_pace_otb_pk ON mv_pace_otb (property_id, ci_month);

DROP MATERIALIZED VIEW IF EXISTS mv_arrivals_departures_today CASCADE;
CREATE MATERIALIZED VIEW mv_arrivals_departures_today AS
SELECT r.property_id, r.reservation_id, r.guest_name, r.guest_email, r.guest_country,
  r.source_name, r.room_type_name, r.rate_plan, r.market_segment,
  r.check_in_date, r.check_out_date, r.nights, r.adults, r.children,
  r.total_amount, r.balance, r.status,
  CASE
    WHEN r.check_in_date = CURRENT_DATE THEN 'arrival'
    WHEN r.check_out_date = CURRENT_DATE THEN 'departure'
    WHEN r.status = 'checked_in' AND r.check_in_date < CURRENT_DATE AND r.check_out_date > CURRENT_DATE THEN 'in_house'
    ELSE 'other'
  END AS today_role
FROM reservations r
WHERE r.status NOT IN ('canceled','no_show')
  AND (r.check_in_date = CURRENT_DATE OR r.check_out_date = CURRENT_DATE
       OR (r.status = 'checked_in' AND r.check_in_date < CURRENT_DATE AND r.check_out_date > CURRENT_DATE));
CREATE UNIQUE INDEX idx_mv_arr_dep_today_pk ON mv_arrivals_departures_today (reservation_id);
CREATE INDEX idx_mv_arr_dep_today_role ON mv_arrivals_departures_today (today_role);

DROP MATERIALIZED VIEW IF EXISTS mv_aged_ar CASCADE;
CREATE MATERIALIZED VIEW mv_aged_ar AS
SELECT r.property_id, r.reservation_id, r.guest_name, r.source_name, r.check_out_date,
  COALESCE(r.balance, 0) AS open_balance,
  CASE WHEN r.check_out_date IS NULL THEN 'in_progress'
    WHEN CURRENT_DATE - r.check_out_date <= 30 THEN '0_30'
    WHEN CURRENT_DATE - r.check_out_date <= 60 THEN '31_60'
    WHEN CURRENT_DATE - r.check_out_date <= 90 THEN '61_90'
    ELSE '90_plus' END AS bucket,
  (CURRENT_DATE - r.check_out_date) AS days_overdue
FROM reservations r
WHERE r.status NOT IN ('canceled','no_show') AND r.balance > 0;
CREATE UNIQUE INDEX idx_mv_aged_ar_pk ON mv_aged_ar (reservation_id);
CREATE INDEX idx_mv_aged_ar_bucket ON mv_aged_ar (bucket);

DROP MATERIALIZED VIEW IF EXISTS mv_capture_rates CASCADE;
CREATE MATERIALIZED VIEW mv_capture_rates AS
WITH window_dates AS (
  SELECT property_id, CURRENT_DATE - 30 AS d_from, CURRENT_DATE AS d_to FROM v_property_inventory
),
occ AS (
  SELECT r.property_id, COUNT(*) AS occ_roomnights
  FROM reservation_rooms rr JOIN reservations r ON r.reservation_id = rr.reservation_id
  CROSS JOIN window_dates w
  WHERE rr.night_date BETWEEN w.d_from AND w.d_to
    AND r.status NOT IN ('canceled','no_show') AND r.property_id = w.property_id
  GROUP BY r.property_id
),
spend AS (
  SELECT t.property_id,
    SUM(t.amount) FILTER (WHERE t.item_category_name ILIKE ANY (ARRAY['%food%','%beverage%','%bar%','%restaurant%','%minibar%'])) AS fnb_spend,
    SUM(t.amount) FILTER (WHERE t.item_category_name ILIKE '%spa%') AS spa_spend,
    SUM(t.amount) FILTER (WHERE t.item_category_name ILIKE ANY (ARRAY['%activit%','%excursion%','%tour%'])) AS activity_spend
  FROM transactions t CROSS JOIN window_dates w
  WHERE t.transaction_date::date BETWEEN w.d_from AND w.d_to
    AND t.category IN ('custom_item','product','addon') AND t.property_id = w.property_id
  GROUP BY t.property_id
)
SELECT o.property_id, o.occ_roomnights,
  COALESCE(s.fnb_spend, 0) AS fnb_revenue_30d,
  COALESCE(s.spa_spend, 0) AS spa_revenue_30d,
  COALESCE(s.activity_spend, 0) AS activity_revenue_30d,
  ROUND(COALESCE(s.fnb_spend, 0) / NULLIF(o.occ_roomnights, 0), 2) AS fnb_per_occ_room,
  ROUND(COALESCE(s.spa_spend, 0) / NULLIF(o.occ_roomnights, 0), 2) AS spa_per_occ_room,
  ROUND(COALESCE(s.activity_spend, 0) / NULLIF(o.occ_roomnights, 0), 2) AS activity_per_occ_room
FROM occ o LEFT JOIN spend s ON s.property_id = o.property_id;
CREATE UNIQUE INDEX idx_mv_capture_rates_pk ON mv_capture_rates (property_id);

DROP MATERIALIZED VIEW IF EXISTS mv_rate_inventory_calendar CASCADE;
CREATE MATERIALIZED VIEW mv_rate_inventory_calendar AS
SELECT ri.property_id, ri.inventory_date, ri.room_type_id, rt.room_type_name,
  ri.rate_id, rp.rate_name, ri.rate AS bar_rate, ri.available_rooms,
  ri.minimum_stay, ri.closed_to_arrival, ri.closed_to_departure, ri.stop_sell
FROM rate_inventory ri
LEFT JOIN room_types rt ON rt.room_type_id = ri.room_type_id
LEFT JOIN rate_plans rp ON rp.rate_id = ri.rate_id
WHERE ri.inventory_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 120;
CREATE UNIQUE INDEX idx_mv_rate_cal_pk ON mv_rate_inventory_calendar (property_id, inventory_date, room_type_id, rate_id);
CREATE INDEX idx_mv_rate_cal_date ON mv_rate_inventory_calendar (inventory_date);

CREATE OR REPLACE FUNCTION refresh_bi_views() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpi_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpi_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_usali_dept;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_channel_perf;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pace_otb;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_arrivals_departures_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_aged_ar;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_capture_rates;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rate_inventory_calendar;
END;
$$ LANGUAGE plpgsql;

GRANT SELECT ON mv_kpi_daily TO anon, authenticated;
GRANT SELECT ON mv_kpi_today TO anon, authenticated;
GRANT SELECT ON mv_revenue_by_usali_dept TO anon, authenticated;
GRANT SELECT ON mv_channel_perf TO anon, authenticated;
GRANT SELECT ON mv_pace_otb TO anon, authenticated;
GRANT SELECT ON mv_arrivals_departures_today TO anon, authenticated;
GRANT SELECT ON mv_aged_ar TO anon, authenticated;
GRANT SELECT ON mv_capture_rates TO anon, authenticated;
GRANT SELECT ON mv_rate_inventory_calendar TO anon, authenticated;
GRANT SELECT ON v_property_inventory TO anon, authenticated;