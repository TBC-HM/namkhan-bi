-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503191718
-- Name:    phase2_staff_payslip_backfill_v3
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Now the FK is sane, run the backfill
BEGIN;
WITH src AS (
  SELECT
    pm.staff_id,
    pm.period_month,
    se.emp_id,
    pm.grand_total_usd,
    pm.fx_lak_usd,
    'hr/' || pm.staff_id::text || '/' || to_char(pm.period_month, 'YYYY-MM') ||
      '/payslip/SYSGEN_' || replace(coalesce(se.emp_id, pm.staff_id::text),' ','_')
      || '_' || to_char(pm.period_month, 'YYYY-MM') || '_payslip.pdf' AS storage_path,
    'SYSGEN_' || replace(coalesce(se.emp_id, pm.staff_id::text),' ','_')
      || '_' || to_char(pm.period_month, 'YYYY-MM') || '_payslip.pdf' AS file_name
  FROM ops.payroll_monthly pm
  JOIN ops.staff_employment se ON se.id = pm.staff_id
  WHERE NOT EXISTS (
    SELECT 1 FROM docs.hr_docs hr
    JOIN docs.documents d ON d.doc_id = hr.doc_id
    WHERE hr.staff_user_id = pm.staff_id
      AND hr.hr_doc_kind = 'payslip'
      AND d.valid_from = pm.period_month
  )
),
ins_doc AS (
  INSERT INTO docs.documents (
    doc_type, doc_subtype, title, summary,
    storage_bucket, storage_path, mime, file_name,
    status, sensitivity, valid_from, period_year,
    amount, amount_currency, raw
  )
  SELECT
    'hr_doc', 'payslip',
    'payslip · ' || COALESCE(s.emp_id, s.staff_id::text) || ' · ' || to_char(s.period_month,'YYYY-MM'),
    'System-generated metadata from ops.payroll_monthly. Replace by uploading the signed PDF via /operations/staff (Upload payslips).',
    'documents-confidential', s.storage_path, 'application/pdf', s.file_name,
    'active', 'confidential', s.period_month, EXTRACT(YEAR FROM s.period_month)::int,
    s.grand_total_usd, 'USD',
    jsonb_build_object('source','ops.payroll_monthly','sysgen', true, 'fx_lak_usd', s.fx_lak_usd)
  FROM src s
  RETURNING doc_id, storage_path
),
ins_hr AS (
  INSERT INTO docs.hr_docs (doc_id, staff_user_id, hr_doc_kind, is_sensitive, notes)
  SELECT
    i.doc_id, src.staff_id, 'payslip', true,
    'Backfilled from ops.payroll_monthly 2026-05-03 (system-generated; awaits real PDF).'
  FROM ins_doc i
  JOIN src ON src.storage_path = i.storage_path
  RETURNING doc_id
)
SELECT count(*) AS hr_docs_inserted FROM ins_hr;
COMMIT;