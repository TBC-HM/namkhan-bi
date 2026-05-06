-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504143239
-- Name:    create_v_inv_item_sales
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Per-item sales aggregates derived from public.transactions (Cloudbeds/Poster POS feed).
-- Joined back to inv.items by lowercased trimmed description ↔ item_name.
-- Excludes tax / fee / payment / room rate lines (same blacklist as sync-poster-pos route).

CREATE OR REPLACE VIEW public.v_inv_item_sales AS
SELECT
  LOWER(TRIM(description))                       AS desc_key,
  MAX(transaction_date)                          AS last_sold_at,
  SUM(amount) FILTER (
    WHERE transaction_date >= date_trunc('year', CURRENT_DATE)
  )::numeric                                     AS ytd_usd,
  SUM(quantity) FILTER (
    WHERE transaction_date >= date_trunc('year', CURRENT_DATE)
  )::numeric                                     AS ytd_qty,
  COUNT(*) FILTER (
    WHERE transaction_date >= date_trunc('year', CURRENT_DATE)
  )                                              AS ytd_lines,
  COUNT(*)                                       AS lines_total
FROM public.transactions
WHERE description IS NOT NULL
  AND amount > 0
  AND LOWER(COALESCE(category, '')) NOT IN ('tax','fee','payment','rate','room_revenue','refund')
  AND description NOT IN (
    'Lao VAT  (10%)','VAT  Tax','Service Charge','Sales Tax','Credit Card','Bank Transfer',
    'Cash','Staff tip','Credit Card Commission ',
    'Service Charge (R)(10%)','Lao VAT (R)(10%)',
    'Service Charge (I)(10%)','Lao VAT (I)(10%)',
    '10% VAT & 10% SERVICE CHARGE'
  )
GROUP BY LOWER(TRIM(description));

GRANT SELECT ON public.v_inv_item_sales TO anon, authenticated, service_role;