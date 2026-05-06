-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502192340
-- Name:    phase2_06_qb_supplier_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE FUNCTION qb.refresh_vendors()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_inserted integer;
BEGIN
  WITH derived AS (
    SELECT
      coalesce(g.vendor_id, g.customer_name) AS vendor_id,
      g.customer_name AS vendor_name,
      max(g.txn_date) AS last_seen,
      CASE
        WHEN g.customer_name ILIKE '%- Lao Kip%' THEN 'LAK'
        WHEN g.customer_name ILIKE '%- USD%' THEN 'USD'
        ELSE 'USD'
      END AS currency_guess
    FROM qb.gl_entries g
    WHERE g.customer_name IS NOT NULL
      AND length(trim(g.customer_name)) > 0
      AND g.qb_txn_type IN ('Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund')
    GROUP BY 1, 2, currency_guess
  )
  INSERT INTO qb.vendors (vendor_id, vendor_name, currency, is_active, source_file, uploaded_at)
  SELECT vendor_id, vendor_name, currency_guess, true, 'auto_from_gl_entries', now()
  FROM derived
  ON CONFLICT (vendor_id) DO UPDATE
    SET vendor_name = excluded.vendor_name,
        currency    = coalesce(qb.vendors.currency, excluded.currency),
        updated_at  = now();
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END $$;

CREATE OR REPLACE VIEW qb.v_supplier_overview AS
WITH txn AS (
  SELECT coalesce(g.customer_name, '<unknown>') AS vendor_name,
         g.txn_date, g.period_yyyymm, g.amount_usd, g.qb_txn_type, g.account_id, g.class_id
    FROM qb.gl_entries g
   WHERE g.customer_name IS NOT NULL AND length(trim(g.customer_name)) > 0
     AND g.qb_txn_type IN ('Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund')
)
SELECT vendor_name, count(*) AS line_count, count(distinct period_yyyymm) AS active_periods,
       min(txn_date) AS first_txn_date, max(txn_date) AS last_txn_date,
       sum(abs(amount_usd)) AS gross_spend_usd, sum(amount_usd) AS net_amount_usd,
       count(distinct account_id) AS distinct_accounts, count(distinct class_id) AS distinct_classes,
       CASE WHEN vendor_name ILIKE '%- Lao Kip%' THEN 'LAK'
            WHEN vendor_name ILIKE '%- USD%' THEN 'USD' ELSE 'USD' END AS currency_guess,
       CASE WHEN max(txn_date) > now() - interval '90 days' THEN true ELSE false END AS is_active_recent
FROM txn GROUP BY vendor_name;

CREATE OR REPLACE VIEW qb.v_supplier_vendor_account AS
SELECT coalesce(g.customer_name, '<unknown>') AS vendor_name,
       g.period_yyyymm, g.account_id, a.account_name, a.qb_type, a.usali_subcategory, a.usali_line_code,
       g.class_id, c.usali_department,
       count(*) AS line_count, sum(abs(g.amount_usd)) AS gross_amount_usd, sum(g.amount_usd) AS net_amount_usd,
       min(g.txn_date) AS first_txn, max(g.txn_date) AS last_txn
FROM qb.gl_entries g
JOIN qb.accounts a ON a.account_id = g.account_id
JOIN qb.classes c  ON c.class_id   = g.class_id
WHERE g.customer_name IS NOT NULL AND length(trim(g.customer_name)) > 0
  AND g.qb_txn_type IN ('Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund')
GROUP BY 1,2,3,4,5,6,7,8,9;

CREATE OR REPLACE VIEW qb.v_supplier_transactions AS
SELECT g.entry_id, coalesce(g.customer_name, '<unknown>') AS vendor_name,
       g.txn_date, g.period_yyyymm, g.qb_txn_type, g.qb_txn_number,
       g.account_id, a.account_name, a.usali_subcategory, a.usali_line_code,
       g.class_id, c.usali_department, g.memo, g.amount_usd, g.txn_currency, g.txn_amount_native
FROM qb.gl_entries g
JOIN qb.accounts a ON a.account_id = g.account_id
JOIN qb.classes c  ON c.class_id   = g.class_id
WHERE g.customer_name IS NOT NULL AND length(trim(g.customer_name)) > 0
  AND g.qb_txn_type IN ('Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund');

CREATE OR REPLACE VIEW qb.v_top_suppliers_ytd AS
SELECT vendor_name, gross_spend_usd, line_count, active_periods, distinct_accounts, last_txn_date,
       rank() OVER (ORDER BY gross_spend_usd DESC) AS rank_ytd
FROM qb.v_supplier_overview
ORDER BY gross_spend_usd DESC;

CREATE OR REPLACE VIEW qb.v_top_suppliers_current_month AS
WITH cur AS (
  SELECT coalesce(g.customer_name, '<unknown>') AS vendor_name,
         sum(abs(g.amount_usd)) AS gross_spend_usd, count(*) AS line_count
    FROM qb.gl_entries g
   WHERE g.customer_name IS NOT NULL AND length(trim(g.customer_name)) > 0
     AND g.qb_txn_type IN ('Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund')
     AND g.period_yyyymm = to_char(now(), 'YYYY-MM')
   GROUP BY 1
)
SELECT vendor_name, gross_spend_usd, line_count,
       rank() OVER (ORDER BY gross_spend_usd DESC) AS rank_month
FROM cur ORDER BY gross_spend_usd DESC;

CREATE OR REPLACE VIEW qb.v_supplier_account_anomalies AS
WITH ranked AS (
  SELECT coalesce(g.customer_name, '<unknown>') AS vendor_name,
         g.account_id, a.account_name,
         sum(abs(g.amount_usd)) AS gross_amount,
         sum(abs(g.amount_usd)) / sum(sum(abs(g.amount_usd))) OVER (PARTITION BY coalesce(g.customer_name, '<unknown>')) AS share_of_vendor_spend
    FROM qb.gl_entries g
    JOIN qb.accounts a ON a.account_id = g.account_id
   WHERE g.customer_name IS NOT NULL AND length(trim(g.customer_name)) > 0
     AND g.qb_txn_type IN ('Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund')
   GROUP BY 1,2,3
)
SELECT * FROM ranked WHERE share_of_vendor_spend < 0.05 ORDER BY vendor_name, gross_amount DESC;