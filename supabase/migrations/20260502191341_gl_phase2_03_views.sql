-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502191341
-- Name:    gl_phase2_03_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE VIEW gl.v_class_department AS
SELECT class_id, qb_class_name, usali_section, usali_department, is_revenue_center, is_active
FROM gl.classes;

CREATE OR REPLACE VIEW gl.v_gl_entries_enriched AS
SELECT g.entry_id, g.txn_date, g.period_yyyymm, g.fiscal_year,
       g.qb_txn_type, g.qb_txn_id, g.qb_txn_number,
       g.account_id, a.account_name, a.qb_type, a.qb_detail_type,
       a.usali_subcategory, a.usali_line_code, a.usali_line_label, a.is_pl, a.mapping_status,
       g.class_id, c.qb_class_name, c.usali_section, c.usali_department, c.is_revenue_center,
       g.vendor_id, v.vendor_name, g.customer_name, g.memo,
       g.debit_usd, g.credit_usd, g.amount_usd,
       g.txn_currency, g.txn_amount_native, g.fx_rate_used, g.amount_lak,
       g.has_class
FROM gl.gl_entries g
JOIN gl.accounts a ON a.account_id = g.account_id
JOIN gl.classes  c ON c.class_id  = g.class_id
LEFT JOIN gl.vendors v ON v.vendor_id = g.vendor_id;

CREATE MATERIALIZED VIEW gl.mv_usali_pl_monthly AS
SELECT g.period_yyyymm, g.fiscal_year, c.usali_section, c.usali_department,
       a.usali_subcategory, a.usali_line_code, a.usali_line_label,
       g.account_id, a.account_name, sum(g.amount_usd) AS amount_usd
FROM gl.gl_entries g
JOIN gl.accounts a ON a.account_id = g.account_id
JOIN gl.classes  c ON c.class_id  = g.class_id
WHERE a.is_pl
GROUP BY 1,2,3,4,5,6,7,8,9;

CREATE INDEX ix_mv_usali_pl_period ON gl.mv_usali_pl_monthly(period_yyyymm);
CREATE INDEX ix_mv_usali_pl_dept   ON gl.mv_usali_pl_monthly(usali_department, period_yyyymm);

CREATE OR REPLACE VIEW gl.v_usali_dept_summary AS
WITH agg AS (
  SELECT period_yyyymm, fiscal_year, usali_department,
    sum(CASE WHEN usali_subcategory = 'Revenue' THEN -amount_usd ELSE 0 END) AS revenue,
    sum(CASE WHEN usali_subcategory = 'Cost of Sales' THEN amount_usd ELSE 0 END) AS cost_of_sales,
    sum(CASE WHEN usali_subcategory = 'Payroll & Related' THEN amount_usd ELSE 0 END) AS payroll,
    sum(CASE WHEN usali_subcategory = 'Other Operating Expenses' THEN amount_usd ELSE 0 END) AS other_op_exp
  FROM gl.mv_usali_pl_monthly
  WHERE usali_department IS NOT NULL AND usali_department <> 'Undistributed'
  GROUP BY 1,2,3
)
SELECT period_yyyymm, fiscal_year, usali_department, revenue, cost_of_sales, payroll, other_op_exp,
       (revenue - cost_of_sales) AS gross_profit,
       (revenue - cost_of_sales - payroll - other_op_exp) AS departmental_profit,
       CASE WHEN revenue <> 0 THEN (revenue - cost_of_sales - payroll - other_op_exp) / revenue ELSE NULL END AS dept_profit_margin
FROM agg;

CREATE OR REPLACE VIEW gl.v_usali_undistributed AS
SELECT period_yyyymm, fiscal_year, usali_subcategory, sum(amount_usd) AS amount_usd
FROM gl.mv_usali_pl_monthly
WHERE usali_section = 'Undistributed' OR usali_department = 'Undistributed'
GROUP BY 1,2,3;

CREATE OR REPLACE VIEW gl.v_usali_house_summary AS
WITH dept AS (
  SELECT period_yyyymm, fiscal_year,
    sum(revenue) AS total_revenue, sum(cost_of_sales) AS total_cost_of_sales,
    sum(payroll) AS total_dept_payroll, sum(other_op_exp) AS total_dept_other_op_exp,
    sum(departmental_profit) AS total_dept_profit
  FROM gl.v_usali_dept_summary GROUP BY 1,2
),
undist AS (
  SELECT period_yyyymm,
    sum(CASE WHEN usali_subcategory = 'A&G' THEN amount_usd ELSE 0 END) AS ag,
    sum(CASE WHEN usali_subcategory = 'Sales & Marketing' THEN amount_usd ELSE 0 END) AS sm,
    sum(CASE WHEN usali_subcategory = 'POM' THEN amount_usd ELSE 0 END) AS pom,
    sum(CASE WHEN usali_subcategory = 'Utilities' THEN amount_usd ELSE 0 END) AS utilities,
    sum(CASE WHEN usali_subcategory = 'Mgmt Fees' THEN amount_usd ELSE 0 END) AS mgmt_fees,
    sum(CASE WHEN usali_subcategory = 'Payroll & Related' THEN amount_usd ELSE 0 END) AS undist_payroll,
    sum(CASE WHEN usali_subcategory = 'Other Operating Expenses' THEN amount_usd ELSE 0 END) AS undist_other
  FROM gl.mv_usali_pl_monthly WHERE usali_section = 'Undistributed' GROUP BY 1
),
fixed AS (
  SELECT period_yyyymm,
    sum(CASE WHEN usali_subcategory = 'Depreciation' THEN amount_usd ELSE 0 END) AS depreciation,
    sum(CASE WHEN usali_subcategory = 'Interest' THEN amount_usd ELSE 0 END) AS interest,
    sum(CASE WHEN usali_subcategory = 'Income Tax' THEN amount_usd ELSE 0 END) AS income_tax,
    sum(CASE WHEN usali_subcategory = 'FX Gain/Loss' THEN amount_usd ELSE 0 END) AS fx_pnl,
    sum(CASE WHEN usali_subcategory = 'Non-Operating' THEN amount_usd ELSE 0 END) AS non_op
  FROM gl.mv_usali_pl_monthly GROUP BY 1
)
SELECT d.period_yyyymm, d.fiscal_year, d.total_revenue, d.total_cost_of_sales,
       d.total_dept_payroll, d.total_dept_other_op_exp, d.total_dept_profit,
       coalesce(u.ag,0) + coalesce(u.undist_payroll,0) + coalesce(u.undist_other,0) AS ag_total,
       coalesce(u.sm,0) AS sales_marketing, coalesce(u.pom,0) AS pom,
       coalesce(u.utilities,0) AS utilities, coalesce(u.mgmt_fees,0) AS mgmt_fees,
       d.total_dept_profit - coalesce(u.ag,0) - coalesce(u.undist_payroll,0) - coalesce(u.undist_other,0)
         - coalesce(u.sm,0) - coalesce(u.pom,0) - coalesce(u.utilities,0) - coalesce(u.mgmt_fees,0) AS gop,
       coalesce(f.depreciation,0) AS depreciation, coalesce(f.interest,0) AS interest,
       coalesce(f.income_tax,0) AS income_tax, coalesce(f.fx_pnl,0) AS fx_pnl,
       coalesce(f.non_op,0) AS non_operating,
       d.total_dept_profit - coalesce(u.ag,0) - coalesce(u.undist_payroll,0) - coalesce(u.undist_other,0)
         - coalesce(u.sm,0) - coalesce(u.pom,0) - coalesce(u.utilities,0) - coalesce(u.mgmt_fees,0)
         - coalesce(f.depreciation,0) - coalesce(f.interest,0) - coalesce(f.income_tax,0)
         - coalesce(f.fx_pnl,0) - coalesce(f.non_op,0) AS net_income
FROM dept d
LEFT JOIN undist u USING (period_yyyymm)
LEFT JOIN fixed  f USING (period_yyyymm);

CREATE OR REPLACE VIEW gl.v_dq_open_findings AS
SELECT finding_id, rule_code, severity, ref_type, ref_id, message, suggested_fix, impact_usd,
       first_seen_at, last_seen_at, source_upload_id,
       CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'med' THEN 3 ELSE 4 END AS sort_severity
FROM gl.dq_findings WHERE status = 'open';

CREATE OR REPLACE VIEW gl.v_dq_history AS
SELECT f.finding_id, f.fingerprint, f.rule_code, f.severity, f.status, f.ref_type, f.ref_id,
       f.message, f.impact_usd, f.first_seen_at, f.last_seen_at, f.resolved_at,
       f.dismissed_reason, f.dismissed_by, f.dismissed_at,
       (SELECT count(*) FROM gl.dq_findings_log l WHERE l.finding_id = f.finding_id) AS event_count
FROM gl.dq_findings f;

CREATE OR REPLACE FUNCTION gl.refresh_pl_views() RETURNS void LANGUAGE plpgsql AS $f$
BEGIN REFRESH MATERIALIZED VIEW gl.mv_usali_pl_monthly; END $f$;
