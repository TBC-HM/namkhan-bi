-- Repoint docs.hr_docs.staff_user_id FK from auth.users(id) -> ops.staff_employment(id).
-- Reason: v_staff_last_payslip and the /operations/staff page treat the column as
-- staff_employment_id. Only ~5 of 70 staff are platform users so the original FK
-- to auth.users blocked legitimate inserts for the other 65.
-- The column name is left as 'staff_user_id' to avoid breaking ops.v_staff_last_payslip.
-- Author: PBS via Claude · 2026-05-03
-- Applied via Supabase MCP on 2026-05-03 (migration: phase2_staff_fix_hr_docs_fk_to_staff_employment).

BEGIN;
ALTER TABLE docs.hr_docs DROP CONSTRAINT IF EXISTS hr_docs_staff_user_id_fkey;
ALTER TABLE docs.hr_docs
  DROP CONSTRAINT IF EXISTS hr_docs_staff_employment_fkey;
ALTER TABLE docs.hr_docs
  ADD CONSTRAINT hr_docs_staff_employment_fkey
  FOREIGN KEY (staff_user_id) REFERENCES ops.staff_employment(id) ON DELETE CASCADE;
COMMENT ON COLUMN docs.hr_docs.staff_user_id IS
  'Misnamed historic column. References ops.staff_employment(id), NOT auth.users.';
COMMIT;
