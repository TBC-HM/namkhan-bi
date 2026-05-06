-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503222923
-- Name:    v_vendor_dept_mapping_v4_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- v4: USALI dept comes from gl.classes (via class_id), USALI line from gl.accounts.
-- "Unmapped" = either account not assigned a USALI line OR entry missing class_id.
DROP VIEW IF EXISTS public.v_vendor_dept_mapping;
DROP VIEW IF EXISTS public.v_unmapped_accounts;

CREATE OR REPLACE VIEW public.v_vendor_dept_mapping AS
WITH vendor_acct AS (
  SELECT
    e.customer_name                                  AS vendor_name,
    e.account_id,
    a.account_name,
    a.usali_subcategory,
    a.usali_line_label,
    a.mapping_status,
    c.usali_department                               AS usali_dept,
    e.class_id,
    SUM(ABS(e.amount_usd))                           AS spend_usd,
    COUNT(*)                                         AS lines,
    MAX(e.txn_date)                                  AS last_txn_date
  FROM gl.gl_entries e
  LEFT JOIN gl.accounts a ON a.account_id = e.account_id
  LEFT JOIN gl.classes  c ON c.class_id   = e.class_id
  WHERE e.customer_name IS NOT NULL
    AND length(TRIM(BOTH FROM e.customer_name)) > 0
    AND e.qb_txn_type = ANY(ARRAY['Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund'])
    AND e.txn_date >= CURRENT_DATE - INTERVAL '180 days'
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
), agg AS (
  SELECT
    vendor_name,
    SUM(spend_usd)                                       AS total_spend_usd,
    SUM(lines)                                           AS total_lines,
    MAX(last_txn_date)                                   AS last_txn_date,
    COUNT(DISTINCT NULLIF(usali_dept,''))                AS distinct_depts,
    COUNT(DISTINCT account_id)                           AS distinct_accounts,
    SUM(CASE WHEN mapping_status IS DISTINCT FROM 'mapped' THEN spend_usd ELSE 0 END) AS unmapped_acct_spend,
    SUM(CASE WHEN class_id IS NULL OR class_id = ''       THEN spend_usd ELSE 0 END) AS no_class_spend
  FROM vendor_acct
  GROUP BY vendor_name
), primary_dept AS (
  SELECT DISTINCT ON (vendor_name)
    vendor_name,
    COALESCE(NULLIF(usali_dept,''), 'No class') AS primary_dept,
    spend_usd                                   AS primary_dept_spend
  FROM vendor_acct
  ORDER BY vendor_name, spend_usd DESC NULLS LAST
)
SELECT
  agg.vendor_name,
  ROUND(agg.total_spend_usd::numeric, 2)           AS total_spend_usd,
  agg.total_lines::int                             AS total_lines,
  agg.last_txn_date,
  agg.distinct_depts::int                          AS distinct_depts,
  agg.distinct_accounts::int                       AS distinct_accounts,
  ROUND(agg.unmapped_acct_spend::numeric, 2)       AS unmapped_acct_spend,
  ROUND(agg.no_class_spend::numeric, 2)            AS no_class_spend,
  ROUND((CASE WHEN agg.total_spend_usd > 0
              THEN (agg.unmapped_acct_spend + agg.no_class_spend) / agg.total_spend_usd * 100
              ELSE 0 END)::numeric, 1)             AS dirty_pct,
  pd.primary_dept,
  ROUND(pd.primary_dept_spend::numeric, 2)         AS primary_dept_spend,
  (agg.unmapped_acct_spend > 0)                    AS f_unmapped_account,
  (agg.no_class_spend > 0)                         AS f_no_class,
  (agg.distinct_depts > 1)                         AS f_multi_dept,
  CASE
    WHEN agg.unmapped_acct_spend > 0 AND agg.no_class_spend > 0 THEN 'Set USALI line + class'
    WHEN agg.unmapped_acct_spend > 0 THEN 'Set USALI line on accounts'
    WHEN agg.no_class_spend > 0 THEN 'Add class in QuickBooks'
    WHEN agg.distinct_depts > 1 THEN 'Vendor splits across depts (review)'
    ELSE 'OK'
  END                                              AS suggested_action
FROM agg
LEFT JOIN primary_dept pd ON pd.vendor_name = agg.vendor_name
ORDER BY agg.total_spend_usd DESC NULLS LAST;

GRANT SELECT ON public.v_vendor_dept_mapping TO anon, authenticated, service_role;

-- Companion: GL accounts with postings but no USALI line.
CREATE OR REPLACE VIEW public.v_unmapped_accounts AS
SELECT
  a.account_id,
  a.account_name,
  a.qb_type,
  a.qb_detail_type,
  COALESCE(a.mapping_status, 'unmapped')                         AS mapping_status,
  COUNT(e.entry_id)::int                                         AS lines,
  ROUND(SUM(ABS(e.amount_usd))::numeric, 2)                      AS spend_usd,
  MAX(e.txn_date)                                                AS last_txn_date
FROM gl.accounts a
LEFT JOIN gl.gl_entries e ON e.account_id = a.account_id
WHERE (a.mapping_status IS DISTINCT FROM 'mapped' OR a.usali_line_label IS NULL)
  AND e.entry_id IS NOT NULL
GROUP BY 1, 2, 3, 4, 5
HAVING SUM(ABS(e.amount_usd)) > 0
ORDER BY spend_usd DESC NULLS LAST;

GRANT SELECT ON public.v_unmapped_accounts TO anon, authenticated, service_role;
