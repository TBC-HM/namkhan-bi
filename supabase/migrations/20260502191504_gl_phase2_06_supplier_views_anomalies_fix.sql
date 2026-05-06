-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502191504
-- Name:    gl_phase2_06_supplier_views_anomalies_fix
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE VIEW gl.v_supplier_account_anomalies AS
WITH agg AS (
  SELECT coalesce(g.customer_name, '<unknown>') AS vendor_name,
         g.account_id, a.account_name,
         sum(abs(g.amount_usd)) AS gross_amount
  FROM gl.gl_entries g
  JOIN gl.accounts a ON a.account_id = g.account_id
  WHERE g.customer_name IS NOT NULL AND length(trim(g.customer_name)) > 0
    AND g.qb_txn_type IN ('Bill','Bill Payment (Cheque)','Cheque','Expense','Vendor Credit','Refund')
  GROUP BY 1,2,3
), with_share AS (
  SELECT vendor_name, account_id, account_name, gross_amount,
         gross_amount / NULLIF(sum(gross_amount) OVER (PARTITION BY vendor_name),0) AS share_of_vendor_spend
  FROM agg
)
SELECT * FROM with_share WHERE share_of_vendor_spend < 0.05;
