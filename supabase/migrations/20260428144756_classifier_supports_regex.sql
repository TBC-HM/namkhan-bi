-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428144756
-- Name:    classifier_supports_regex
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

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
    AND CASE
      -- regex match against item_category_name OR description (if cat empty)
      WHEN m.match_type = 'regex' THEN
        (NULLIF(t.item_category_name,'') ~* m.match_pattern)
        OR (NULLIF(t.item_category_name,'') IS NULL AND NULLIF(t.description,'') ~* m.match_pattern)
        OR (NULLIF(t.category,'') ~* m.match_pattern)
      ELSE
        -- ilike (default)
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

GRANT SELECT ON v_classified_transactions TO anon, authenticated;