-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427182328
-- Name:    kpi_skill_capture_rate
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- SKILL: kpi.capture_rate(date_from, date_to, dim)
-- Returns penetration % + spend per occupied room
-- per dept (and optionally split by source/country/room_type)
-- ============================================================

DROP FUNCTION IF EXISTS kpi.capture_rate(date, date, text);

CREATE OR REPLACE FUNCTION kpi.capture_rate(
  p_from date DEFAULT (CURRENT_DATE - 30),
  p_to date DEFAULT (CURRENT_DATE - 1),
  p_dimension text DEFAULT 'overall'  -- 'overall' | 'source' | 'country' | 'room_type'
)
RETURNS TABLE(
  dimension_value text,
  usali_dept text,
  usali_subdept text,
  reservations_in_house int,
  res_with_purchase int,
  capture_rate_pct numeric,
  revenue numeric,
  spend_per_occ_room numeric,
  avg_spend_per_buyer numeric,
  items_sold numeric
) AS $$
BEGIN
  IF p_dimension = 'overall' THEN
    RETURN QUERY
    WITH base AS (
      SELECT 
        COUNT(DISTINCT r.reservation_id) AS res_in_house,
        SUM(rr.rate)::numeric AS rooms_rev,
        COUNT(*) AS occ_room_nights
      FROM reservation_rooms rr
      JOIN reservations r ON r.reservation_id = rr.reservation_id
      WHERE NOT r.is_cancelled
        AND rr.night_date BETWEEN p_from AND p_to
    ),
    ancil AS (
      SELECT 
        t.usali_dept,
        t.usali_subdept,
        COUNT(DISTINCT t.reservation_id) AS res_with_purchase,
        SUM(t.amount) FILTER (WHERE t.transaction_type='debit') AS rev,
        SUM(t.quantity) FILTER (WHERE t.transaction_type='debit') AS items
      FROM transactions t
      WHERE t.service_date BETWEEN p_from AND p_to
        AND t.usali_dept NOT IN ('Tax','Fee','Adjustment')
      GROUP BY t.usali_dept, t.usali_subdept
    )
    SELECT 
      'ALL'::text,
      a.usali_dept,
      a.usali_subdept,
      b.res_in_house::int,
      a.res_with_purchase::int,
      ROUND(100.0 * a.res_with_purchase / NULLIF(b.res_in_house,0), 1)::numeric,
      ROUND(a.rev::numeric, 0),
      ROUND(a.rev / NULLIF(b.occ_room_nights,0)::numeric, 2),
      ROUND(a.rev / NULLIF(a.res_with_purchase,0)::numeric, 2),
      a.items::numeric
    FROM ancil a CROSS JOIN base b
    ORDER BY a.rev DESC;
    
  ELSIF p_dimension = 'source' THEN
    RETURN QUERY
    WITH base AS (
      SELECT 
        COALESCE(NULLIF(r.source_name,''),'(blank)') AS dim,
        COUNT(DISTINCT r.reservation_id) AS res_in_house,
        COUNT(*) AS occ_room_nights
      FROM reservation_rooms rr
      JOIN reservations r ON r.reservation_id = rr.reservation_id
      WHERE NOT r.is_cancelled
        AND rr.night_date BETWEEN p_from AND p_to
      GROUP BY 1
    ),
    ancil AS (
      SELECT 
        COALESCE(NULLIF(r.source_name,''),'(blank)') AS dim,
        t.usali_dept, t.usali_subdept,
        COUNT(DISTINCT t.reservation_id) AS res_with_purchase,
        SUM(t.amount) FILTER (WHERE t.transaction_type='debit') AS rev,
        SUM(t.quantity) FILTER (WHERE t.transaction_type='debit') AS items
      FROM transactions t
      JOIN reservations r ON r.reservation_id = t.reservation_id
      WHERE t.service_date BETWEEN p_from AND p_to
        AND t.usali_dept NOT IN ('Tax','Fee','Adjustment')
      GROUP BY 1, t.usali_dept, t.usali_subdept
    )
    SELECT 
      a.dim, a.usali_dept, a.usali_subdept,
      b.res_in_house::int, a.res_with_purchase::int,
      ROUND(100.0 * a.res_with_purchase / NULLIF(b.res_in_house,0), 1)::numeric,
      ROUND(a.rev::numeric, 0),
      ROUND(a.rev / NULLIF(b.occ_room_nights,0)::numeric, 2),
      ROUND(a.rev / NULLIF(a.res_with_purchase,0)::numeric, 2),
      a.items::numeric
    FROM ancil a JOIN base b ON b.dim = a.dim
    ORDER BY a.dim, a.rev DESC;
    
  ELSIF p_dimension = 'country' THEN
    RETURN QUERY
    WITH base AS (
      SELECT 
        COALESCE(NULLIF(r.guest_country,''),'??') AS dim,
        COUNT(DISTINCT r.reservation_id) AS res_in_house,
        COUNT(*) AS occ_room_nights
      FROM reservation_rooms rr
      JOIN reservations r ON r.reservation_id = rr.reservation_id
      WHERE NOT r.is_cancelled AND rr.night_date BETWEEN p_from AND p_to
      GROUP BY 1
    ),
    ancil AS (
      SELECT 
        COALESCE(NULLIF(r.guest_country,''),'??') AS dim,
        t.usali_dept, t.usali_subdept,
        COUNT(DISTINCT t.reservation_id) AS res_with_purchase,
        SUM(t.amount) FILTER (WHERE t.transaction_type='debit') AS rev,
        SUM(t.quantity) FILTER (WHERE t.transaction_type='debit') AS items
      FROM transactions t
      JOIN reservations r ON r.reservation_id = t.reservation_id
      WHERE t.service_date BETWEEN p_from AND p_to
        AND t.usali_dept NOT IN ('Tax','Fee','Adjustment')
      GROUP BY 1, t.usali_dept, t.usali_subdept
    )
    SELECT 
      a.dim, a.usali_dept, a.usali_subdept,
      b.res_in_house::int, a.res_with_purchase::int,
      ROUND(100.0 * a.res_with_purchase / NULLIF(b.res_in_house,0), 1)::numeric,
      ROUND(a.rev::numeric, 0),
      ROUND(a.rev / NULLIF(b.occ_room_nights,0)::numeric, 2),
      ROUND(a.rev / NULLIF(a.res_with_purchase,0)::numeric, 2),
      a.items::numeric
    FROM ancil a JOIN base b ON b.dim = a.dim
    ORDER BY a.dim, a.rev DESC;
    
  ELSIF p_dimension = 'room_type' THEN
    RETURN QUERY
    WITH base AS (
      SELECT 
        COALESCE(NULLIF(r.room_type_name,''),'(blank)') AS dim,
        COUNT(DISTINCT r.reservation_id) AS res_in_house,
        COUNT(*) AS occ_room_nights
      FROM reservation_rooms rr
      JOIN reservations r ON r.reservation_id = rr.reservation_id
      WHERE NOT r.is_cancelled AND rr.night_date BETWEEN p_from AND p_to
      GROUP BY 1
    ),
    ancil AS (
      SELECT 
        COALESCE(NULLIF(r.room_type_name,''),'(blank)') AS dim,
        t.usali_dept, t.usali_subdept,
        COUNT(DISTINCT t.reservation_id) AS res_with_purchase,
        SUM(t.amount) FILTER (WHERE t.transaction_type='debit') AS rev,
        SUM(t.quantity) FILTER (WHERE t.transaction_type='debit') AS items
      FROM transactions t
      JOIN reservations r ON r.reservation_id = t.reservation_id
      WHERE t.service_date BETWEEN p_from AND p_to
        AND t.usali_dept NOT IN ('Tax','Fee','Adjustment')
      GROUP BY 1, t.usali_dept, t.usali_subdept
    )
    SELECT 
      a.dim, a.usali_dept, a.usali_subdept,
      b.res_in_house::int, a.res_with_purchase::int,
      ROUND(100.0 * a.res_with_purchase / NULLIF(b.res_in_house,0), 1)::numeric,
      ROUND(a.rev::numeric, 0),
      ROUND(a.rev / NULLIF(b.occ_room_nights,0)::numeric, 2),
      ROUND(a.rev / NULLIF(a.res_with_purchase,0)::numeric, 2),
      a.items::numeric
    FROM ancil a JOIN base b ON b.dim = a.dim
    ORDER BY a.dim, a.rev DESC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
