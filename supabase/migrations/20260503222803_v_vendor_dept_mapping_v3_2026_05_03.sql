-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503222803
-- Name:    v_vendor_dept_mapping_v3_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- v3: vendor name is on gl_entries.customer_name (not via vendor_id).
-- Same filter as gl.v_supplier_overview to stay aligned.
DROP VIEW IF EXISTS public.v_vendor_dept_mapping;

CREATE OR REPLACE VIEW public.v_vendor_dept_mapping AS
WITH vendor_acct AS (
  SELECT
    e.customer_name                                  AS vendor_name,
    e.account_id,
    a.account_name,
    em.usali_dept,
    em.usali_subdept,
    SUM(ABS(e.amount_usd))                           AS spend_usd,
    COUNT(*)                                         AS lines,
    MAX(e.txn_date)                                  AS last_txn_date
  FROM gl.gl_entries e
  LEFT JOIN gl.accounts a           ON a.account_id = e.account_id
  LEFT JOIN gl.usali_expense_map em ON em.gl_code   = e.account_id
  WHERE e.customer_name IS NOT NULL
    AND length(TRIM(BOTH FROM e.customer_name)) > 0
    AND e.qb_txn_type = ANY(ARRAY['Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund'])
    AND e.txn_date >= CURRENT_DATE - INTERVAL '180 days'
  GROUP BY 1, 2, 3, 4, 5
), agg AS (
  SELECT
    vendor_name,
    SUM(spend_usd)                                       AS total_spend_usd,
    SUM(lines)                                           AS total_lines,
    MAX(last_txn_date)                                   AS last_txn_date,
    COUNT(DISTINCT NULLIF(usali_dept,''))                AS distinct_depts,
    COUNT(DISTINCT account_id)                           AS distinct_accounts,
    SUM(CASE WHEN usali_dept IS NULL OR usali_dept = '' THEN spend_usd ELSE 0 END) AS unmapped_spend_usd
  FROM vendor_acct
  GROUP BY vendor_name
), primary_dept AS (
  SELECT DISTINCT ON (vendor_name)
    vendor_name,
    COALESCE(NULLIF(usali_dept,''), 'Unmapped') AS primary_dept,
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
  ROUND(agg.unmapped_spend_usd::numeric, 2)        AS unmapped_spend_usd,
  ROUND((CASE WHEN agg.total_spend_usd > 0
              THEN agg.unmapped_spend_usd / agg.total_spend_usd * 100
              ELSE 0 END)::numeric, 1)             AS unmapped_pct,
  pd.primary_dept,
  ROUND(pd.primary_dept_spend::numeric, 2)         AS primary_dept_spend,
  (agg.unmapped_spend_usd > 0)                     AS f_has_unmapped,
  (agg.distinct_depts > 1)                         AS f_multi_dept,
  CASE
    WHEN agg.unmapped_spend_usd > 0 THEN 'Map account in usali_expense_map'
    WHEN agg.distinct_depts > 1 THEN 'Set primary dept override (vendor splits)'
    ELSE 'OK'
  END                                              AS suggested_action
FROM agg
LEFT JOIN primary_dept pd ON pd.vendor_name = agg.vendor_name
ORDER BY agg.total_spend_usd DESC NULLS LAST;

GRANT SELECT ON public.v_vendor_dept_mapping TO anon, authenticated, service_role;
