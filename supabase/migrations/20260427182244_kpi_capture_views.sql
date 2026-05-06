-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427182244
-- Name:    kpi_capture_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ===========================================================
-- CAPTURE-RATE views — daily granularity
-- ===========================================================
-- Each view: per service_date, per dept/subdept, with both penetration and spend metrics

-- 1) Daily ancillary spend per dept (revenue side)
CREATE OR REPLACE VIEW kpi.v_ancillary_daily AS
SELECT 
  service_date AS stay_date,
  usali_dept,
  usali_subdept,
  COUNT(*) AS tx_count,
  COUNT(DISTINCT reservation_id) FILTER (WHERE reservation_id IS NOT NULL) AS reservations_with_purchase,
  SUM(amount) FILTER (WHERE transaction_type='debit') AS revenue,
  SUM(quantity) FILTER (WHERE transaction_type='debit') AS items_sold,
  AVG(amount) FILTER (WHERE transaction_type='debit') AS avg_ticket
FROM transactions
WHERE service_date IS NOT NULL
  AND usali_dept IS NOT NULL
  AND usali_dept NOT IN ('Tax','Fee','Adjustment')
GROUP BY service_date, usali_dept, usali_subdept;

-- 2) Capture-rate daily — penetration % and spend per occupied room
CREATE OR REPLACE VIEW kpi.v_capture_rate_daily AS
WITH base AS (SELECT * FROM kpi.v_occupancy_base),
ancil AS (SELECT * FROM kpi.v_ancillary_daily WHERE usali_dept IN ('F&B','Other Operated','Retail'))
SELECT 
  b.stay_date,
  COALESCE(a.usali_dept, '(none)') AS usali_dept,
  COALESCE(a.usali_subdept, '') AS usali_subdept,
  b.occupied_room_nights,
  b.reservations_in_house,
  COALESCE(a.reservations_with_purchase, 0) AS res_with_purchase,
  -- Penetration: % of in-house res that bought from this dept
  ROUND(100.0 * COALESCE(a.reservations_with_purchase,0) / NULLIF(b.reservations_in_house,0), 1) AS capture_rate_pct,
  -- Spend per occupied room
  ROUND(COALESCE(a.revenue,0) / NULLIF(b.occupied_room_nights,0), 2) AS spend_per_occ_room,
  COALESCE(a.revenue, 0) AS revenue,
  COALESCE(a.tx_count, 0) AS tx_count,
  COALESCE(a.avg_ticket, 0) AS avg_ticket
FROM base b
LEFT JOIN ancil a ON a.stay_date = b.stay_date;

-- 3) Reservation-level ancillary rollup — total spend per reservation by dept
CREATE OR REPLACE VIEW kpi.v_reservation_ancillary AS
WITH res_tx AS (
  SELECT 
    t.reservation_id,
    t.usali_dept,
    SUM(CASE WHEN t.transaction_type='debit' THEN t.amount ELSE 0 END) AS dept_revenue,
    COUNT(*) FILTER (WHERE t.transaction_type='debit') AS dept_tx_count
  FROM transactions t
  WHERE t.reservation_id IS NOT NULL 
    AND t.usali_dept NOT IN ('Tax','Fee','Adjustment')
  GROUP BY t.reservation_id, t.usali_dept
),
res_pivot AS (
  SELECT 
    reservation_id,
    SUM(dept_revenue) FILTER (WHERE usali_dept='Rooms') AS rooms_rev,
    SUM(dept_revenue) FILTER (WHERE usali_dept='F&B') AS fb_rev,
    SUM(dept_revenue) FILTER (WHERE usali_dept='Other Operated') AS other_op_rev,
    SUM(dept_revenue) FILTER (WHERE usali_dept='Retail') AS retail_rev,
    SUM(dept_revenue) FILTER (WHERE usali_dept='Misc Income') AS misc_rev,
    SUM(dept_revenue) AS total_rev,
    SUM(dept_tx_count) AS total_tx
  FROM res_tx
  GROUP BY reservation_id
)
SELECT 
  r.reservation_id, r.guest_name, r.guest_country, r.source_name, 
  r.room_type_name, r.check_in_date, r.check_out_date, r.nights, r.status,
  COALESCE(p.rooms_rev,0) AS rooms_rev,
  COALESCE(p.fb_rev,0) AS fb_rev,
  COALESCE(p.other_op_rev,0) AS other_op_rev,
  COALESCE(p.retail_rev,0) AS retail_rev,
  COALESCE(p.misc_rev,0) AS misc_rev,
  COALESCE(p.total_rev,0) AS total_rev,
  COALESCE(p.fb_rev + p.other_op_rev + p.retail_rev + p.misc_rev, 0) AS ancillary_rev,
  CASE WHEN COALESCE(p.fb_rev,0) > 0 THEN 1 ELSE 0 END AS has_fb,
  CASE WHEN COALESCE(p.other_op_rev,0) > 0 THEN 1 ELSE 0 END AS has_other_op,
  CASE WHEN COALESCE(p.retail_rev,0) > 0 THEN 1 ELSE 0 END AS has_retail,
  COALESCE(p.total_tx,0) AS total_tx
FROM reservations r
LEFT JOIN res_pivot p ON p.reservation_id = r.reservation_id
WHERE NOT r.is_cancelled;

-- 4) Subdept-level capture (Spa, Activities, Transport, Minibar etc separately)
CREATE OR REPLACE VIEW kpi.v_capture_by_subdept AS
WITH res_subdept AS (
  SELECT 
    t.reservation_id,
    t.usali_dept || COALESCE(' / ' || t.usali_subdept, '') AS dept_full,
    t.usali_dept,
    t.usali_subdept,
    SUM(CASE WHEN t.transaction_type='debit' THEN t.amount ELSE 0 END) AS rev,
    COUNT(*) FILTER (WHERE t.transaction_type='debit') AS items
  FROM transactions t
  WHERE t.reservation_id IS NOT NULL
    AND t.usali_dept NOT IN ('Tax','Fee','Adjustment')
  GROUP BY t.reservation_id, t.usali_dept, t.usali_subdept
)
SELECT 
  rs.usali_dept,
  rs.usali_subdept,
  rs.dept_full,
  COUNT(DISTINCT rs.reservation_id) AS reservations_with_purchase,
  SUM(rs.rev) AS revenue,
  SUM(rs.items) AS items_sold,
  ROUND(AVG(rs.rev)::numeric, 2) AS avg_spend_per_reservation
FROM res_subdept rs
GROUP BY rs.usali_dept, rs.usali_subdept, rs.dept_full;
