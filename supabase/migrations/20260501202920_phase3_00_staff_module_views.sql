-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501202920
-- Name:    phase3_00_staff_module_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- ===========================================================
-- Phase 3 / Operations · Staff module
-- 3 read views + 1 RLS policy. No table changes.
-- ===========================================================

-- 1) Allow owner/gm/finance/hr to SELECT from docs.hr_docs.
--    Existing pattern (mirrors ops.payroll_monthly_read).
DROP POLICY IF EXISTS hr_docs_read ON docs.hr_docs;
CREATE POLICY hr_docs_read ON docs.hr_docs
  FOR SELECT
  TO authenticated
  USING (app.has_role(ARRAY['owner','gm','finance','hr']));

-- 2) Last payslip per staff
CREATE OR REPLACE VIEW ops.v_staff_last_payslip AS
SELECT
  hr.staff_user_id                     AS staff_id,
  MAX(d.valid_from)                    AS last_payslip_period,
  COUNT(*)                             AS payslip_count
FROM docs.hr_docs hr
JOIN docs.documents d ON d.doc_id = hr.doc_id
WHERE hr.hr_doc_kind = 'payslip'
GROUP BY hr.staff_user_id;

GRANT SELECT ON ops.v_staff_last_payslip TO authenticated;

-- 3) Staff register extended with payslip status
CREATE OR REPLACE VIEW ops.v_staff_register_extended AS
SELECT
  r.*,
  lp.last_payslip_period,
  COALESCE(lp.payslip_count, 0)        AS payslip_count,
  CASE
    WHEN lp.last_payslip_period IS NULL                                                            THEN 'never'
    WHEN lp.last_payslip_period >= (date_trunc('month', now())::date - INTERVAL '1 month')::date   THEN 'current'
    ELSE 'overdue'
  END                                  AS payslip_status
FROM ops.v_staff_register r
LEFT JOIN ops.v_staff_last_payslip lp ON lp.staff_id = r.staff_id;

GRANT SELECT ON ops.v_staff_register_extended TO authenticated;

-- 4) HR anomalies (powers Section 3 cards)
CREATE OR REPLACE VIEW ops.v_staff_anomalies AS
SELECT 'missing_hire_date'::text  AS issue, staff_id, full_name, dept_code, dept_name
  FROM ops.v_staff_register
  WHERE is_active = true AND hire_date IS NULL
UNION ALL
SELECT 'missing_employee_code', staff_id, full_name, dept_code, dept_name
  FROM ops.v_staff_register
  WHERE is_active = true AND (emp_id IS NULL OR emp_id = '')
UNION ALL
SELECT 'contract_expiring_60d', se.id, r.full_name, r.dept_code, r.dept_name
  FROM ops.staff_employment se
  JOIN ops.v_staff_register r ON r.staff_id = se.id
  WHERE se.is_active = true
    AND se.end_date IS NOT NULL
    AND se.end_date <= (now() + INTERVAL '60 days')::date
UNION ALL
SELECT 'no_payslip_last_month', r.staff_id, r.full_name, r.dept_code, r.dept_name
  FROM ops.v_staff_register_extended r
  WHERE r.is_active = true
    AND r.payslip_status IN ('never','overdue');

GRANT SELECT ON ops.v_staff_anomalies TO authenticated;

COMMENT ON VIEW ops.v_staff_register_extended IS
  'Staff register joined with last-payslip status. Read by /operations/staff page.';
COMMENT ON VIEW ops.v_staff_anomalies IS
  'HR data-quality alerts: missing hire_date, missing employee_code, expiring contracts, missing payslip.';
COMMENT ON VIEW ops.v_staff_last_payslip IS
  'Aggregated last payslip period per staff_id. Internal helper for v_staff_register_extended.';