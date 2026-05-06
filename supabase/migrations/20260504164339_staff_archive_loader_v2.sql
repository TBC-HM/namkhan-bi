-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504164339
-- Name:    staff_archive_loader_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION ops.f_staff_archive_loader(p_rows jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, public
AS $$
DECLARE n int := 0; r record;
BEGIN
  FOR r IN
    SELECT
      (j->>'emp_id') AS emp_id,
      (j->>'full_name') AS full_name,
      (j->>'dept_code') AS dept_code,
      NULLIF((j->>'position'), '') AS position_title,
      NULLIF((j->>'hire_date'), '')::date AS hire_date,
      NULLIF((j->>'end_date'), '')::date AS end_date,
      COALESCE((j->>'monthly_salary')::numeric, 0) AS monthly_salary,
      NULLIF((j->>'bank_name'), '') AS bank_name,
      NULLIF((j->>'bank_account_no'), '') AS bank_account_no,
      NULLIF((j->>'bank_account_name'), '') AS bank_account_name,
      NULLIF((j->>'phone'), '') AS phone,
      NULLIF((j->>'notes'), '') AS notes
    FROM jsonb_array_elements(p_rows) j
  LOOP
    -- Try update first (matches by emp_id)
    UPDATE ops.staff_employment SET
      full_name = COALESCE(r.full_name, full_name),
      position_title = COALESCE(r.position_title, position_title),
      end_date = COALESCE(r.end_date, end_date),
      bank_name = COALESCE(r.bank_name, bank_name),
      bank_account_no = COALESCE(r.bank_account_no, bank_account_no),
      bank_account_name = COALESCE(r.bank_account_name, bank_account_name),
      phone = COALESCE(r.phone, phone),
      notes = COALESCE(r.notes, notes),
      updated_at = NOW()
    WHERE emp_id = r.emp_id;
    IF FOUND THEN
      n := n + 1;
    ELSE
      INSERT INTO ops.staff_employment (
        id, property_id, emp_id, full_name, position_title, dept_id,
        employment_type, monthly_salary, salary_currency, hourly_cost_lak,
        contract_hours_pw, hire_date, end_date, is_active,
        bank_name, bank_account_no, bank_account_name, phone, notes
      ) VALUES (
        gen_random_uuid(), 260955, r.emp_id, r.full_name, r.position_title,
        ops.f_dept_id(r.dept_code), 'full_time',
        r.monthly_salary, 'LAK',
        ROUND(r.monthly_salary / NULLIF(48*4.33, 0), 0), 48,
        r.hire_date, COALESCE(r.end_date, CURRENT_DATE), false,
        r.bank_name, r.bank_account_no, r.bank_account_name, r.phone, r.notes
      );
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;
