-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428144346
-- Name:    create_usali_classifier_and_rebuild_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- v_classified_transactions : every transaction tagged with USALI dept/subdept
-- using usali_category_map (priority-ordered, first match wins per transaction)
-- =============================================================================
CREATE OR REPLACE VIEW v_classified_transactions AS
WITH ranked AS (
  SELECT
    t.transaction_id, t.property_id, t.reservation_id, t.transaction_date,
    t.category, t.transaction_type, t.item_category_name, t.description,
    t.amount, t.currency, t.user_name,
    m.usali_dept, m.usali_subdept, m.priority,
    -- Pick the highest-priority (lowest number) match per transaction
    ROW_NUMBER() OVER (PARTITION BY t.transaction_id
                       ORDER BY m.priority ASC, m.id ASC) AS rn
  FROM transactions t
  LEFT JOIN usali_category_map m
    ON m.is_active = true
    AND (
      -- match against item_category_name (primary), then category, then description
      (NULLIF(t.item_category_name,'') ILIKE '%' || m.match_pattern || '%')
      OR (NULLIF(t.category,'') ILIKE '%' || m.match_pattern || '%')
    )
)
SELECT
  transaction_id, property_id, reservation_id, transaction_date,
  category, transaction_type, item_category_name, description,
  amount, currency, user_name,
  COALESCE(usali_dept, 'Unclassified') AS usali_dept,
  usali_subdept
FROM ranked
WHERE rn = 1 OR rn IS NULL;

GRANT SELECT ON v_classified_transactions TO anon, authenticated;

-- =============================================================================
-- Rebuild mv_kpi_daily using usali map
-- =============================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_kpi_daily CASCADE;
CREATE MATERIALIZED VIEW mv_kpi_daily AS
WITH nightly AS (
  SELECT r.property_id, rr.night_date,
    COUNT(*) FILTER (WHERE r.status NOT IN ('canceled','no_show')) AS rooms_sold,
    COALESCE(SUM(rr.rate) FILTER (WHERE r.status NOT IN ('canceled','no_show')), 0) AS rooms_revenue
  FROM reservation_rooms rr
  JOIN reservations r ON r.reservation_id = rr.reservation_id
  GROUP BY r.property_id, rr.night_date
),
ancillary AS (
  SELECT
    ct.property_id, ct.transaction_date::date AS night_date,
    SUM(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Food'      THEN ct.amount ELSE 0 END) AS fnb_food_revenue,
    SUM(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Beverage'  THEN ct.amount ELSE 0 END) AS fnb_beverage_revenue,
    SUM(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Minibar'   THEN ct.amount ELSE 0 END) AS fnb_minibar_revenue,
    SUM(CASE WHEN ct.usali_dept = 'F&B'                                     THEN ct.amount ELSE 0 END) AS fnb_revenue,
    SUM(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Spa'             THEN ct.amount ELSE 0 END) AS spa_revenue,
    SUM(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Activities'      THEN ct.amount ELSE 0 END) AS activity_revenue,
    SUM(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Transportation'  THEN ct.amount ELSE 0 END) AS transport_revenue,
    SUM(CASE WHEN ct.usali_dept = 'Other Operated'                                          THEN ct.amount ELSE 0 END) AS other_operated_revenue,
    SUM(CASE WHEN ct.usali_dept = 'Retail'                                                  THEN ct.amount ELSE 0 END) AS retail_revenue,
    SUM(CASE WHEN ct.usali_dept NOT IN ('Tax','Fee','Adjustment','Rooms')                   THEN ct.amount ELSE 0 END) AS total_ancillary_revenue
  FROM v_classified_transactions ct
  WHERE ct.category IN ('custom_item','product','addon')
    AND ct.transaction_date IS NOT NULL
  GROUP BY ct.property_id, ct.transaction_date::date
)
SELECT
  COALESCE(n.property_id, a.property_id) AS property_id,
  COALESCE(n.night_date, a.night_date) AS night_date,
  COALESCE(n.rooms_sold, 0) AS rooms_sold,
  inv.total_rooms,
  GREATEST(inv.total_rooms - COALESCE(n.rooms_sold, 0), 0) AS rooms_available,
  ROUND(100.0 * COALESCE(n.rooms_sold, 0) / NULLIF(inv.total_rooms, 0), 2) AS occupancy_pct,
  COALESCE(n.rooms_revenue, 0) AS rooms_revenue,
  ROUND(COALESCE(n.rooms_revenue, 0) / NULLIF(n.rooms_sold, 0), 2) AS adr,
  ROUND(COALESCE(n.rooms_revenue, 0) / NULLIF(inv.total_rooms, 0), 2) AS revpar,
  COALESCE(a.fnb_food_revenue, 0) AS fnb_food_revenue,
  COALESCE(a.fnb_beverage_revenue, 0) AS fnb_beverage_revenue,
  COALESCE(a.fnb_minibar_revenue, 0) AS fnb_minibar_revenue,
  COALESCE(a.fnb_revenue, 0) AS fnb_revenue,
  COALESCE(a.spa_revenue, 0) AS spa_revenue,
  COALESCE(a.activity_revenue, 0) AS activity_revenue,
  COALESCE(a.transport_revenue, 0) AS transport_revenue,
  COALESCE(a.other_operated_revenue, 0) AS other_operated_revenue,
  COALESCE(a.retail_revenue, 0) AS retail_revenue,
  COALESCE(a.total_ancillary_revenue, 0) AS total_ancillary_revenue,
  ROUND((COALESCE(n.rooms_revenue, 0) + COALESCE(a.total_ancillary_revenue, 0)) / NULLIF(inv.total_rooms, 0), 2) AS trevpar
FROM nightly n
FULL OUTER JOIN ancillary a ON n.property_id = a.property_id AND n.night_date = a.night_date
LEFT JOIN v_property_inventory inv ON inv.property_id = COALESCE(n.property_id, a.property_id);

CREATE UNIQUE INDEX idx_mv_kpi_daily_pk ON mv_kpi_daily (property_id, night_date);
CREATE INDEX idx_mv_kpi_daily_date ON mv_kpi_daily (night_date);
GRANT SELECT ON mv_kpi_daily TO anon, authenticated;

-- =============================================================================
-- Rebuild mv_revenue_by_usali_dept using map
-- =============================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_revenue_by_usali_dept CASCADE;
CREATE MATERIALIZED VIEW mv_revenue_by_usali_dept AS
WITH room_rev AS (
  SELECT r.property_id, DATE_TRUNC('month', rr.night_date)::date AS month,
         'Rooms' AS usali_dept, 'Transient' AS usali_subdept,
         SUM(rr.rate) AS revenue, COUNT(*) AS units
  FROM reservation_rooms rr JOIN reservations r ON r.reservation_id = rr.reservation_id
  WHERE r.status NOT IN ('canceled','no_show')
  GROUP BY r.property_id, DATE_TRUNC('month', rr.night_date)
),
ancillary AS (
  SELECT ct.property_id, DATE_TRUNC('month', ct.transaction_date)::date AS month,
         ct.usali_dept, COALESCE(ct.usali_subdept, '') AS usali_subdept,
         SUM(ct.amount) AS revenue, COUNT(*) AS units
  FROM v_classified_transactions ct
  WHERE ct.category IN ('custom_item','product','addon')
    AND ct.transaction_date IS NOT NULL
    AND ct.usali_dept NOT IN ('Tax','Fee','Adjustment')
  GROUP BY 1, 2, 3, 4
)
SELECT property_id, month, usali_dept, usali_subdept, SUM(revenue) AS revenue, SUM(units) AS units
FROM (SELECT * FROM room_rev UNION ALL SELECT * FROM ancillary) x
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX idx_mv_rev_usali_pk ON mv_revenue_by_usali_dept (property_id, month, usali_dept, usali_subdept);
GRANT SELECT ON mv_revenue_by_usali_dept TO anon, authenticated;

-- =============================================================================
-- Rebuild mv_capture_rates using map
-- =============================================================================
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
  SELECT ct.property_id,
    SUM(CASE WHEN ct.usali_dept='F&B' THEN ct.amount ELSE 0 END) AS fnb_spend,
    SUM(CASE WHEN ct.usali_dept='Other Operated' AND ct.usali_subdept='Spa' THEN ct.amount ELSE 0 END) AS spa_spend,
    SUM(CASE WHEN ct.usali_dept='Other Operated' AND ct.usali_subdept='Activities' THEN ct.amount ELSE 0 END) AS activity_spend,
    SUM(CASE WHEN ct.usali_dept='Retail' THEN ct.amount ELSE 0 END) AS retail_spend,
    COUNT(DISTINCT ct.reservation_id) FILTER (WHERE ct.usali_dept='F&B') AS fnb_resv,
    COUNT(DISTINCT ct.reservation_id) FILTER (WHERE ct.usali_dept='Other Operated' AND ct.usali_subdept='Spa') AS spa_resv,
    COUNT(DISTINCT ct.reservation_id) FILTER (WHERE ct.usali_dept='Other Operated' AND ct.usali_subdept='Activities') AS act_resv
  FROM v_classified_transactions ct CROSS JOIN window_dates w
  WHERE ct.transaction_date::date BETWEEN w.d_from AND w.d_to
    AND ct.category IN ('custom_item','product','addon')
    AND ct.property_id = w.property_id
  GROUP BY ct.property_id
),
total_resv AS (
  SELECT r.property_id, COUNT(DISTINCT r.reservation_id) AS total_resv
  FROM reservations r CROSS JOIN window_dates w
  WHERE r.check_in_date BETWEEN w.d_from AND w.d_to
    AND r.status NOT IN ('canceled','no_show')
    AND r.property_id = w.property_id
  GROUP BY r.property_id
)
SELECT
  o.property_id, o.occ_roomnights, tr.total_resv,
  COALESCE(s.fnb_spend, 0) AS fnb_revenue_30d,
  COALESCE(s.spa_spend, 0) AS spa_revenue_30d,
  COALESCE(s.activity_spend, 0) AS activity_revenue_30d,
  COALESCE(s.retail_spend, 0) AS retail_revenue_30d,
  ROUND(COALESCE(s.fnb_spend, 0) / NULLIF(o.occ_roomnights, 0), 2) AS fnb_per_occ_room,
  ROUND(COALESCE(s.spa_spend, 0) / NULLIF(o.occ_roomnights, 0), 2) AS spa_per_occ_room,
  ROUND(COALESCE(s.activity_spend, 0) / NULLIF(o.occ_roomnights, 0), 2) AS activity_per_occ_room,
  ROUND(100.0 * COALESCE(s.fnb_resv, 0) / NULLIF(tr.total_resv, 0), 1) AS fnb_capture_pct,
  ROUND(100.0 * COALESCE(s.spa_resv, 0) / NULLIF(tr.total_resv, 0), 1) AS spa_capture_pct,
  ROUND(100.0 * COALESCE(s.act_resv, 0) / NULLIF(tr.total_resv, 0), 1) AS activity_capture_pct
FROM occ o
LEFT JOIN spend s ON s.property_id = o.property_id
LEFT JOIN total_resv tr ON tr.property_id = o.property_id;

CREATE UNIQUE INDEX idx_mv_capture_rates_pk ON mv_capture_rates (property_id);
GRANT SELECT ON mv_capture_rates TO anon, authenticated;

-- Update refresh function to include the view (no v_ since it's a view, not mat)
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