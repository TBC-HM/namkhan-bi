-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428144534
-- Name:    v_classified_transactions_use_description_fallback
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Make classifier use description as fallback when item_category_name is empty
CREATE OR REPLACE VIEW v_classified_transactions AS
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
    AND (
      (NULLIF(t.item_category_name,'') ILIKE '%' || m.match_pattern || '%')
      OR (NULLIF(t.item_category_name,'') IS NULL AND NULLIF(t.description,'') ILIKE '%' || m.match_pattern || '%')
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