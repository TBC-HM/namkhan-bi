-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429224932
-- Name:    fix_capture_rates_b2_window_alignment_2026_04_30
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B2: capture rate had window mismatch
-- numerator (resv with F&B/Spa/Activity charges): filtered by transaction_date in 30d
-- denominator (total_resv): filtered by check_in_date in 30d
-- Result: a guest who checked in 35d ago and ate today is in numerator but not denominator
-- → inflated capture %
--
-- Fix: align both to "reservations with check_in_date in last 30d AND status not canceled/no_show"
-- Numerator becomes: of those reservations, how many have ANY F&B/Spa/Activity transaction
-- (regardless of when posted — the spend belongs to the stay, not the calendar window)

DROP MATERIALIZED VIEW IF EXISTS public.mv_capture_rates CASCADE;

CREATE MATERIALIZED VIEW public.mv_capture_rates AS
WITH window_dates AS (
  SELECT property_id, CURRENT_DATE - 30 AS d_from, CURRENT_DATE AS d_to
  FROM v_property_inventory
),
-- All non-canceled reservations whose check-in falls in the 30d window
qualifying_resv AS (
  SELECT r.property_id, r.reservation_id
  FROM reservations r
  JOIN window_dates w ON w.property_id = r.property_id
  WHERE r.check_in_date BETWEEN w.d_from AND w.d_to
    AND r.status NOT IN ('canceled','no_show')
),
-- Occupied roomnights (rooms_sold within window)
occ AS (
  SELECT
    r.property_id,
    COUNT(*) AS occ_roomnights
  FROM reservation_rooms rr
  JOIN reservations r ON r.reservation_id = rr.reservation_id
  JOIN window_dates w ON w.property_id = r.property_id
  WHERE rr.night_date BETWEEN w.d_from AND w.d_to
    AND r.status NOT IN ('canceled','no_show')
  GROUP BY r.property_id
),
-- Spend totals scoped to the same 30d transaction window (kept as before — for $/occ-rn metric)
spend AS (
  SELECT
    ct.property_id,
    SUM(CASE WHEN ct.usali_dept='F&B' THEN ct.amount ELSE 0 END) AS fnb_spend,
    SUM(CASE WHEN ct.usali_dept='Other Operated' AND ct.usali_subdept='Spa' THEN ct.amount ELSE 0 END) AS spa_spend,
    SUM(CASE WHEN ct.usali_dept='Other Operated' AND ct.usali_subdept='Activities' THEN ct.amount ELSE 0 END) AS activity_spend,
    SUM(CASE WHEN ct.usali_dept='Retail' THEN ct.amount ELSE 0 END) AS retail_spend
  FROM mv_classified_transactions ct
  JOIN window_dates w ON w.property_id = ct.property_id
  WHERE ct.transaction_date::date BETWEEN w.d_from AND w.d_to
    AND ct.category IN ('custom_item','product','addon')
  GROUP BY ct.property_id
),
-- B2 fix: numerator counts reservations from the qualifying set that have ANY F&B/Spa/Activity charge
capture_counts AS (
  SELECT
    qr.property_id,
    COUNT(DISTINCT qr.reservation_id) AS total_resv,
    COUNT(DISTINCT qr.reservation_id) FILTER (
      WHERE EXISTS (SELECT 1 FROM mv_classified_transactions t
                    WHERE t.reservation_id = qr.reservation_id AND t.usali_dept = 'F&B')
    ) AS fnb_resv,
    COUNT(DISTINCT qr.reservation_id) FILTER (
      WHERE EXISTS (SELECT 1 FROM mv_classified_transactions t
                    WHERE t.reservation_id = qr.reservation_id
                      AND t.usali_dept = 'Other Operated' AND t.usali_subdept = 'Spa')
    ) AS spa_resv,
    COUNT(DISTINCT qr.reservation_id) FILTER (
      WHERE EXISTS (SELECT 1 FROM mv_classified_transactions t
                    WHERE t.reservation_id = qr.reservation_id
                      AND t.usali_dept = 'Other Operated' AND t.usali_subdept = 'Activities')
    ) AS act_resv
  FROM qualifying_resv qr
  GROUP BY qr.property_id
)
SELECT
  o.property_id,
  o.occ_roomnights,
  c.total_resv,
  COALESCE(s.fnb_spend,0)      AS fnb_revenue_30d,
  COALESCE(s.spa_spend,0)      AS spa_revenue_30d,
  COALESCE(s.activity_spend,0) AS activity_revenue_30d,
  COALESCE(s.retail_spend,0)   AS retail_revenue_30d,
  ROUND(COALESCE(s.fnb_spend,0)      / NULLIF(o.occ_roomnights,0)::numeric, 2) AS fnb_per_occ_room,
  ROUND(COALESCE(s.spa_spend,0)      / NULLIF(o.occ_roomnights,0)::numeric, 2) AS spa_per_occ_room,
  ROUND(COALESCE(s.activity_spend,0) / NULLIF(o.occ_roomnights,0)::numeric, 2) AS activity_per_occ_room,
  ROUND(100.0 * COALESCE(c.fnb_resv,0)::numeric / NULLIF(c.total_resv,0)::numeric, 1) AS fnb_capture_pct,
  ROUND(100.0 * COALESCE(c.spa_resv,0)::numeric / NULLIF(c.total_resv,0)::numeric, 1) AS spa_capture_pct,
  ROUND(100.0 * COALESCE(c.act_resv,0)::numeric / NULLIF(c.total_resv,0)::numeric, 1) AS activity_capture_pct
FROM occ o
LEFT JOIN spend s          ON s.property_id = o.property_id
LEFT JOIN capture_counts c ON c.property_id = o.property_id;

CREATE UNIQUE INDEX idx_mv_capture_rates_pk ON public.mv_capture_rates (property_id);

COMMENT ON MATERIALIZED VIEW public.mv_capture_rates IS
'30d capture rates. B2 fix 2026-04-30: numerator and denominator now share the same reservation set (check_in_date in 30d, anti-canceled). Spend $-totals still windowed by transaction_date.';