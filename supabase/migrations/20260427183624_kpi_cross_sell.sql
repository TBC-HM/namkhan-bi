-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427183624
-- Name:    kpi_cross_sell
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- MODULE 2: Cross-sell / top combos / item co-purchase
-- ============================================================

-- Co-occurrence at subdept level: of reservations that bought X, how many also bought Y?
CREATE OR REPLACE VIEW kpi.v_subdept_combos AS
WITH res_subdepts AS (
  SELECT DISTINCT reservation_id, 
    usali_dept || COALESCE(' / ' || usali_subdept, '') AS dept_full
  FROM transactions
  WHERE reservation_id IS NOT NULL 
    AND transaction_type = 'debit'
    AND usali_dept NOT IN ('Tax','Fee','Adjustment')
),
pairs AS (
  SELECT a.dept_full AS dept_a, b.dept_full AS dept_b, a.reservation_id
  FROM res_subdepts a
  JOIN res_subdepts b ON a.reservation_id = b.reservation_id 
    AND a.dept_full < b.dept_full
),
totals AS (
  SELECT dept_full, COUNT(DISTINCT reservation_id) AS res_with_dept
  FROM res_subdepts GROUP BY dept_full
)
SELECT 
  p.dept_a, p.dept_b,
  COUNT(DISTINCT p.reservation_id) AS co_purchase_count,
  ta.res_with_dept AS dept_a_total,
  tb.res_with_dept AS dept_b_total,
  -- Lift: P(A and B) / (P(A) * P(B))  >1 means correlated
  ROUND((COUNT(DISTINCT p.reservation_id)::numeric * 
         (SELECT COUNT(DISTINCT reservation_id) FROM res_subdepts) 
         / NULLIF(ta.res_with_dept * tb.res_with_dept, 0))::numeric, 2) AS lift,
  -- Conditional: P(B | A)
  ROUND(100.0 * COUNT(DISTINCT p.reservation_id) / NULLIF(ta.res_with_dept, 0), 1) AS pct_a_buyers_buy_b,
  ROUND(100.0 * COUNT(DISTINCT p.reservation_id) / NULLIF(tb.res_with_dept, 0), 1) AS pct_b_buyers_buy_a
FROM pairs p
JOIN totals ta ON ta.dept_full = p.dept_a
JOIN totals tb ON tb.dept_full = p.dept_b
GROUP BY p.dept_a, p.dept_b, ta.res_with_dept, tb.res_with_dept;

-- Top items by revenue (description-level granularity)
CREATE OR REPLACE FUNCTION kpi.top_items(
  p_from date DEFAULT (CURRENT_DATE - 90),
  p_to date DEFAULT (CURRENT_DATE - 1),
  p_dept text DEFAULT NULL,  -- 'Spa' | 'F&B' | etc
  p_limit int DEFAULT 25
) RETURNS TABLE(
  description text, usali_dept text, usali_subdept text,
  units bigint, revenue numeric, avg_price numeric, distinct_guests bigint
) AS $$
  SELECT 
    description,
    (array_agg(usali_dept))[1],
    (array_agg(usali_subdept))[1],
    COUNT(*),
    ROUND(SUM(amount)::numeric, 0),
    ROUND((SUM(amount) / NULLIF(SUM(quantity),0))::numeric, 2),
    COUNT(DISTINCT reservation_id)
  FROM transactions
  WHERE service_date BETWEEN p_from AND p_to
    AND transaction_type = 'debit'
    AND description IS NOT NULL AND description <> ''
    AND usali_dept NOT IN ('Tax','Fee','Adjustment')
    AND (p_dept IS NULL OR usali_dept = p_dept OR usali_subdept = p_dept)
  GROUP BY description
  ORDER BY SUM(amount) DESC NULLS LAST
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;

-- Avg ancillary spend per stay, per source
CREATE OR REPLACE VIEW kpi.v_ancillary_per_source AS
WITH ra AS (SELECT * FROM kpi.v_reservation_ancillary)
SELECT 
  COALESCE(NULLIF(source_name,''),'(blank)') AS source_name,
  COUNT(*) AS reservations,
  ROUND(AVG(rooms_rev)::numeric, 0) AS avg_rooms,
  ROUND(AVG(fb_rev)::numeric, 0) AS avg_fb,
  ROUND(AVG(other_op_rev)::numeric, 0) AS avg_other_op,
  ROUND(AVG(retail_rev)::numeric, 0) AS avg_retail,
  ROUND(AVG(ancillary_rev)::numeric, 0) AS avg_ancillary,
  ROUND(AVG(total_rev)::numeric, 0) AS avg_total,
  ROUND(100.0 * AVG(ancillary_rev) / NULLIF(AVG(total_rev),0), 1) AS ancillary_pct_of_total
FROM ra
WHERE check_in_date BETWEEN CURRENT_DATE - 365 AND CURRENT_DATE - 1
GROUP BY source_name
HAVING COUNT(*) >= 5
ORDER BY avg_total DESC;

-- Cross-sell readiness: reservations that bought rooms only (no ancillaries)
CREATE OR REPLACE VIEW kpi.v_no_ancillary_buyers AS
SELECT 
  source_name,
  guest_country,
  room_type_name,
  COUNT(*) AS reservations,
  COUNT(*) FILTER (WHERE ancillary_rev = 0) AS no_ancillary,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ancillary_rev = 0) / NULLIF(COUNT(*),0), 1) AS pct_no_ancillary,
  ROUND(SUM(rooms_rev)::numeric, 0) AS rooms_rev_at_risk
FROM kpi.v_reservation_ancillary
WHERE check_in_date BETWEEN CURRENT_DATE - 365 AND CURRENT_DATE - 1
GROUP BY source_name, guest_country, room_type_name
HAVING COUNT(*) >= 5
ORDER BY pct_no_ancillary DESC, rooms_rev_at_risk DESC;
