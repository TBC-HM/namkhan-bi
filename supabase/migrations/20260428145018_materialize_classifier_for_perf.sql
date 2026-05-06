-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428145018
-- Name:    materialize_classifier_for_perf
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Drop the view (downstream views will be recreated to use mv version)
DROP VIEW IF EXISTS v_classified_transactions CASCADE;

-- Build as a materialized view so we compute the expensive classification ONCE
CREATE MATERIALIZED VIEW mv_classified_transactions AS
WITH ranked AS (
  SELECT
    t.transaction_id, t.property_id, t.reservation_id, t.transaction_date,
    t.category, t.transaction_type, t.item_category_name, t.description,
    t.amount, t.currency, t.user_name,
    m.usali_dept, m.usali_subdept, m.priority, m.id AS map_id,
    ROW_NUMBER() OVER (PARTITION BY t.transaction_id
                       ORDER BY m.priority ASC, m.id ASC) AS rn
  FROM transactions t
  LEFT JOIN usali_category_map m
    ON m.is_active = true
    AND CASE
      WHEN m.match_type = 'regex' THEN
        (NULLIF(t.item_category_name,'') ~* m.match_pattern)
        OR (NULLIF(t.item_category_name,'') IS NULL AND NULLIF(t.description,'') ~* m.match_pattern)
        OR (NULLIF(t.category,'') ~* m.match_pattern)
      ELSE
        (NULLIF(t.item_category_name,'') ILIKE '%' || m.match_pattern || '%')
        OR (NULLIF(t.item_category_name,'') IS NULL AND NULLIF(t.description,'') ILIKE '%' || m.match_pattern || '%')
        OR (NULLIF(t.category,'') ILIKE '%' || m.match_pattern || '%')
    END
)
SELECT
  transaction_id, property_id, reservation_id, transaction_date,
  category, transaction_type, item_category_name, description,
  amount, currency, user_name,
  COALESCE(usali_dept, 'Unclassified') AS usali_dept,
  usali_subdept
FROM ranked
WHERE rn = 1 OR rn IS NULL;

CREATE UNIQUE INDEX idx_mv_class_tx_pk ON mv_classified_transactions (transaction_id);
CREATE INDEX idx_mv_class_tx_date ON mv_classified_transactions (transaction_date);
CREATE INDEX idx_mv_class_tx_dept ON mv_classified_transactions (usali_dept, usali_subdept);
CREATE INDEX idx_mv_class_tx_resv ON mv_classified_transactions (reservation_id);
GRANT SELECT ON mv_classified_transactions TO anon, authenticated;