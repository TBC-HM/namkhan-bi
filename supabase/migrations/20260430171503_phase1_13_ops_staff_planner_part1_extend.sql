-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171503
-- Name:    phase1_13_ops_staff_planner_part1_extend
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- v1.4 part 1 — extend existing ops tables, add missing depts
-- ============================================================

-- 1. Add missing departments observed in payroll
INSERT INTO ops.departments (property_id, code, name, is_active) VALUES
  (260955, 'admin_general', 'Admin & General', true),
  (260955, 'boat',          'Boat (I-Mekong)',  true),
  (260955, 'grounds',       'Farm, Garden & Building', true),
  (260955, 'security',      'Security',         true)
ON CONFLICT DO NOTHING;

-- 2. Extend ops.staff_employment with payroll-relevant fields
ALTER TABLE ops.staff_employment
  ADD COLUMN IF NOT EXISTS emp_id            text,           -- 'TNK 401' from payroll
  ADD COLUMN IF NOT EXISTS full_name         text,           -- needed for non-auth staff
  ADD COLUMN IF NOT EXISTS position_title    text,           -- 'Head chef'
  ADD COLUMN IF NOT EXISTS skills            text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS contract_hours_pw numeric(4,1) DEFAULT 48,
  ADD COLUMN IF NOT EXISTS hire_date         date,
  ADD COLUMN IF NOT EXISTS hourly_cost_lak   numeric(10,0),  -- derived: monthly_salary / (hrs/wk * 4.33)
  ADD COLUMN IF NOT EXISTS is_platform_user  boolean DEFAULT false; -- false = not in auth.users

-- emp_id should be globally unique within property
CREATE UNIQUE INDEX IF NOT EXISTS staff_employment_emp_id_uq
  ON ops.staff_employment (property_id, emp_id) WHERE emp_id IS NOT NULL;

-- user_id is currently NOT NULL — relax it so non-platform staff fit
ALTER TABLE ops.staff_employment ALTER COLUMN user_id DROP NOT NULL;

-- 3. Extend ops.shift_templates with the 13-shift legend codes used on the time sheet
INSERT INTO ops.shift_templates (property_id, code, name, start_time, end_time, break_min) VALUES
  (260955, 'S1',   'Shift 1',         '05:00', '14:00', 60),
  (260955, 'S2',   'Shift 2',         '06:00', '15:00', 60),
  (260955, 'S3',   'Shift 3',         '07:00', '16:00', 60),
  (260955, 'S4',   'Shift 4',         '08:00', '17:00', 60),
  (260955, 'S5',   'Shift 5',         '09:00', '18:00', 60),
  (260955, 'S5_1', 'Split AM',        '09:00', '14:00', 0),
  (260955, 'S5_2', 'Split PM',        '17:00', '21:00', 0),
  (260955, 'S6',   'Shift 6',         '13:00', '22:00', 60),
  (260955, 'S7',   'Shift 7',         '14:00', '23:00', 60),
  (260955, 'S8',   'Shift 8',         '15:00', '00:00', 60),
  (260955, 'S9',   'Shift 9 (Night)', '23:00', '08:00', 60),
  (260955, 'S10',  'Shift 10',        '21:30', '06:30', 60),
  (260955, 'S11',  'Shift 11',        '10:00', '19:00', 60),
  (260955, 'S12',  'Shift 12',        '12:00', '21:00', 60),
  (260955, 'S13',  'Shift 13',        '06:00', '20:00', 90)
ON CONFLICT DO NOTHING;
