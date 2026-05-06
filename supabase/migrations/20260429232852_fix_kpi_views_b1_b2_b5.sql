-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429232852
-- Name:    fix_kpi_views_b1_b2_b5
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- Audit fixes from 2026-04-29 deployment audit
-- B1: in_house should match occupied_tonight (not strict status='checked_in')
-- B2: capture_rates window mismatch (transaction date vs check_in date)
-- B5: rooms_available column name is misleading (it's unsold, not inventory)
-- =============================================================================

-- ===== B1: mv_kpi_today.in_house redefinition =====
-- Old: count(*) where r.status = 'checked_in' AND check_in <= today AND check_out > today
-- New: count distinct reservations occupying a roomnight tonight that aren't canceled/no_show
--      i.e. same logic as occupied_tonight (so the two columns can never disagree).
-- Also rename `total_rooms` semantics not changed; add `rooms_inventory` alias for clarity.

DROP MATERIALIZED VIEW IF EXISTS public.mv_kpi_today CASCADE;

CREATE MATERIALIZED VIEW public.mv_kpi_today AS
SELECT
  inv.property_id,
  CURRENT_DATE AS as_of,
  inv.total_rooms,
  inv.total_rooms AS rooms_inventory,
  -- B1 FIX: in_house now consistent with occupied_tonight
  ( SELECT count(DISTINCT r.reservation_id)
      FROM reservations r
      JOIN reservation_rooms rr ON rr.reservation_id = r.reservation_id
     WHERE r.property_id = inv.property_id
       AND rr.night_date = CURRENT_DATE
       AND r.status NOT IN ('canceled','no_show')
  ) AS in_house,
  ( SELECT count(*)
      FROM reservations r
     WHERE r.property_id = inv.property_id
       AND r.check_in_date = CURRENT_DATE
       AND r.status NOT IN ('canceled','no_show')
  ) AS arrivals_today,
  ( SELECT count(*)
      FROM reservations r
     WHERE r.property_id = inv.property_id
       AND r.check_out_date = CURRENT_DATE
       AND r.status NOT IN ('canceled','no_show')
  ) AS departures_today,
  ( SELECT count(*)
      FROM reservations r
     WHERE r.property_id = inv.property_id
       AND r.check_in_date >= CURRENT_DATE
       AND r.check_in_date <= (CURRENT_DATE + 90)
       AND r.status NOT IN ('canceled','no_show')
  ) AS otb_next_90d,
  -- occupied_tonight kept for API compat; identical to in_house now
  ( SELECT count(DISTINCT r.reservation_id)
      FROM reservations r
      JOIN reservation_rooms rr ON rr.reservation_id = r.reservation_id
     WHERE r.property_id = inv.property_id
       AND rr.night_date = CURRENT_DATE
       AND r.status NOT IN ('canceled','no_show')
  ) AS occupied_tonight,
  ( SELECT round(100.0 * count(*) FILTER (WHERE r.status = 'canceled')::numeric
                 / NULLIF(count(*), 0)::numeric, 2)
      FROM reservations r
     WHERE r.property_id = inv.property_id
       AND r.booking_date >= (CURRENT_DATE - 90)
  ) AS cancellation_pct_90d,
  ( SELECT round(100.0 * count(*) FILTER (WHERE r.status = 'no_show')::numeric
                 / NULLIF(count(*) FILTER (WHERE r.status <> 'canceled'), 0)::numeric, 2)
      FROM reservations r
     WHERE r.property_id = inv.property_id
       AND r.check_in_date >= (CURRENT_DATE - 90)
       AND r.check_in_date <= CURRENT_DATE
  ) AS no_show_pct_90d
FROM v_property_inventory inv;

REFRESH MATERIALIZED VIEW public.mv_kpi_today;

-- ===== B2: mv_capture_rates window alignment =====
-- Old: numerator counts reservations with a transaction in last 30d (regardless of check-in)
--      denominator counts reservations checking in within last 30d
-- New: both reservation sets are reservations that checked in within the period.
--      Capture % = distinct check-in-period reservations with at least one F&B/Spa/Activity charge
--      / total check-in-period reservations.

DROP MATERIALIZED VIEW IF EXISTS public.mv_capture_rates CASCADE;

CREATE MATERIALIZED VIEW public.mv_capture_rates AS
WITH window_dates AS (
  SELECT v_property_inventory.property_id,
         (CURRENT_DATE - 30) AS d_from,
         CURRENT_DATE AS d_to
    FROM v_property_inventory
),
period_resv AS (
  SELECT r.property_id, r.reservation_id
    FROM reservations r
    JOIN window_dates w USING (property_id)
   WHERE r.check_in_date >= w.d_from
     AND r.check_in_date <= w.d_to
     AND r.status NOT IN ('canceled','no_show')
),
occ AS (
  SELECT r.property_id, count(*) AS occ_roomnights
    FROM reservation_rooms rr
    JOIN reservations r ON r.reservation_id = rr.reservation_id
    JOIN window_dates w ON w.property_id = r.property_id
   WHERE rr.night_date >= w.d_from
     AND rr.night_date <= w.d_to
     AND r.status NOT IN ('canceled','no_show')
   GROUP BY r.property_id
),
spend AS (
  SELECT ct.property_id,
    sum(CASE WHEN ct.usali_dept = 'F&B' THEN ct.amount ELSE 0 END) AS fnb_spend,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Spa' THEN ct.amount ELSE 0 END) AS spa_spend,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Activities' THEN ct.amount ELSE 0 END) AS activity_spend,
    sum(CASE WHEN ct.usali_dept = 'Retail' THEN ct.amount ELSE 0 END) AS retail_spend,
    -- B2 FIX: only count reservations that are in our period_resv set
    count(DISTINCT ct.reservation_id) FILTER (WHERE ct.usali_dept = 'F&B'
      AND ct.reservation_id IN (SELECT reservation_id FROM period_resv)) AS fnb_resv,
    count(DISTINCT ct.reservation_id) FILTER (WHERE ct.usali_dept = 'Other Operated'
      AND ct.usali_subdept = 'Spa'
      AND ct.reservation_id IN (SELECT reservation_id FROM period_resv)) AS spa_resv,
    count(DISTINCT ct.reservation_id) FILTER (WHERE ct.usali_dept = 'Other Operated'
      AND ct.usali_subdept = 'Activities'
      AND ct.reservation_id IN (SELECT reservation_id FROM period_resv)) AS act_resv
    FROM mv_classified_transactions ct
    JOIN window_dates w ON w.property_id = ct.property_id
   WHERE ct.transaction_date::date >= w.d_from
     AND ct.transaction_date::date <= w.d_to
     AND ct.category IN ('custom_item','product','addon')
   GROUP BY ct.property_id
),
total_resv AS (
  SELECT property_id, count(*) AS total_resv
    FROM period_resv
   GROUP BY property_id
)
SELECT
  o.property_id,
  o.occ_roomnights,
  tr.total_resv,
  COALESCE(s.fnb_spend, 0) AS fnb_revenue_30d,
  COALESCE(s.spa_spend, 0) AS spa_revenue_30d,
  COALESCE(s.activity_spend, 0) AS activity_revenue_30d,
  COALESCE(s.retail_spend, 0) AS retail_revenue_30d,
  round(COALESCE(s.fnb_spend, 0) / NULLIF(o.occ_roomnights, 0)::numeric, 2) AS fnb_per_occ_room,
  round(COALESCE(s.spa_spend, 0) / NULLIF(o.occ_roomnights, 0)::numeric, 2) AS spa_per_occ_room,
  round(COALESCE(s.activity_spend, 0) / NULLIF(o.occ_roomnights, 0)::numeric, 2) AS activity_per_occ_room,
  round(100.0 * COALESCE(s.fnb_resv, 0)::numeric / NULLIF(tr.total_resv, 0)::numeric, 1) AS fnb_capture_pct,
  round(100.0 * COALESCE(s.spa_resv, 0)::numeric / NULLIF(tr.total_resv, 0)::numeric, 1) AS spa_capture_pct,
  round(100.0 * COALESCE(s.act_resv, 0)::numeric / NULLIF(tr.total_resv, 0)::numeric, 1) AS activity_capture_pct
FROM occ o
LEFT JOIN spend s ON s.property_id = o.property_id
LEFT JOIN total_resv tr ON tr.property_id = o.property_id;

REFRESH MATERIALIZED VIEW public.mv_capture_rates;

-- ===== B5: mv_kpi_daily column rename for clarity =====
-- Old: rooms_available = total_rooms - rooms_sold (i.e. unsold) — misleading name
-- New: keep rooms_available as alias (back-compat) but add rooms_unsold (clear) and rooms_inventory (denominator)

DROP MATERIALIZED VIEW IF EXISTS public.mv_kpi_daily CASCADE;

CREATE MATERIALIZED VIEW public.mv_kpi_daily AS
WITH nightly AS (
  SELECT r.property_id,
    rr.night_date,
    count(*) FILTER (WHERE r.status NOT IN ('canceled','no_show')) AS rooms_sold,
    COALESCE(sum(rr.rate) FILTER (WHERE r.status NOT IN ('canceled','no_show')), 0) AS rooms_revenue
  FROM reservation_rooms rr
  JOIN reservations r ON r.reservation_id = rr.reservation_id
  GROUP BY r.property_id, rr.night_date
),
ancillary AS (
  SELECT ct.property_id,
    ct.transaction_date::date AS night_date,
    sum(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Food'     THEN ct.amount ELSE 0 END) AS fnb_food_revenue,
    sum(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Beverage' THEN ct.amount ELSE 0 END) AS fnb_beverage_revenue,
    sum(CASE WHEN ct.usali_dept = 'F&B' AND ct.usali_subdept = 'Minibar'  THEN ct.amount ELSE 0 END) AS fnb_minibar_revenue,
    sum(CASE WHEN ct.usali_dept = 'F&B'                                   THEN ct.amount ELSE 0 END) AS fnb_revenue,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Spa'            THEN ct.amount ELSE 0 END) AS spa_revenue,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Activities'     THEN ct.amount ELSE 0 END) AS activity_revenue,
    sum(CASE WHEN ct.usali_dept = 'Other Operated' AND ct.usali_subdept = 'Transportation' THEN ct.amount ELSE 0 END) AS transport_revenue,
    sum(CASE WHEN ct.usali_dept = 'Other Operated'                                          THEN ct.amount ELSE 0 END) AS other_operated_revenue,
    sum(CASE WHEN ct.usali_dept = 'Retail'                                                  THEN ct.amount ELSE 0 END) AS retail_revenue,
    sum(CASE WHEN ct.usali_dept NOT IN ('Tax','Fee','Adjustment','Rooms')                   THEN ct.amount ELSE 0 END) AS total_ancillary_revenue,
    sum(CASE WHEN ct.usali_dept = 'Unclassified'                                            THEN ct.amount ELSE 0 END) AS unclassified_revenue
  FROM mv_classified_transactions ct
  WHERE ct.category IN ('custom_item','product','addon')
    AND ct.transaction_date IS NOT NULL
  GROUP BY ct.property_id, (ct.transaction_date::date)
)
SELECT
  COALESCE(n.property_id, a.property_id) AS property_id,
  COALESCE(n.night_date, a.night_date) AS night_date,
  COALESCE(n.rooms_sold, 0) AS rooms_sold,
  inv.total_rooms,
  -- B5 FIX: clearer denominator
  inv.total_rooms AS rooms_inventory,
  -- back-compat alias still pointing to "unsold" (the original semantics)
  GREATEST(inv.total_rooms - COALESCE(n.rooms_sold, 0), 0) AS rooms_unsold,
  GREATEST(inv.total_rooms - COALESCE(n.rooms_sold, 0), 0) AS rooms_available,  -- legacy name
  round(100.0 * COALESCE(n.rooms_sold, 0)::numeric / NULLIF(inv.total_rooms, 0)::numeric, 2) AS occupancy_pct,
  COALESCE(n.rooms_revenue, 0) AS rooms_revenue,
  round(COALESCE(n.rooms_revenue, 0) / NULLIF(n.rooms_sold, 0)::numeric, 2) AS adr,
  round(COALESCE(n.rooms_revenue, 0) / NULLIF(inv.total_rooms, 0)::numeric, 2) AS revpar,
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
  COALESCE(a.unclassified_revenue, 0) AS unclassified_revenue,
  round((COALESCE(n.rooms_revenue, 0) + COALESCE(a.total_ancillary_revenue, 0))
        / NULLIF(inv.total_rooms, 0)::numeric, 2) AS trevpar
FROM nightly n
FULL JOIN ancillary a ON n.property_id = a.property_id AND n.night_date = a.night_date
LEFT JOIN v_property_inventory inv ON inv.property_id = COALESCE(n.property_id, a.property_id);

REFRESH MATERIALIZED VIEW public.mv_kpi_daily;

-- Mark migration complete in dq_known_issues
UPDATE dq_known_issues
   SET status = 'fixed',
       notes = COALESCE(notes, '') || E'\n[2026-04-29] B1 fixed: in_house & occupied_tonight unified.'
 WHERE id = 1 AND notes NOT LIKE '%B1 fixed%';