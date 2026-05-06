-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171558
-- Name:    phase1_15_ops_task_catalog_planner
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- v1.4 part 3 — task catalog + instances + plan runs + skills
-- ============================================================

-- 1. Skills taxonomy — canonical list
CREATE TABLE IF NOT EXISTS ops.skills (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  category    text,                       -- 'cleaning','technical','culinary','service','admin','language'
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO ops.skills (code, name, category) VALUES
  ('hk_room_clean',     'Room cleaning (standard)',  'cleaning'),
  ('hk_deep_clean',     'Deep clean',                'cleaning'),
  ('hk_turndown',       'Turndown service',          'cleaning'),
  ('hk_laundry',        'Laundry & linen',           'cleaning'),
  ('hk_public_area',    'Public area cleaning',      'cleaning'),
  ('mnt_electrical',    'Electrical (basic)',        'technical'),
  ('mnt_plumbing',      'Plumbing (basic)',          'technical'),
  ('mnt_aircon',        'AC service & filter',       'technical'),
  ('mnt_carpentry',     'Carpentry',                 'technical'),
  ('mnt_pool',          'Pool & water systems',      'technical'),
  ('mnt_generator',     'Generator service',         'technical'),
  ('grd_garden',        'Gardening',                 'technical'),
  ('grd_farm',          'Farm work',                 'technical'),
  ('grd_landscape',     'Landscaping',               'technical'),
  ('fb_chef_lead',      'Head chef / chef de partie','culinary'),
  ('fb_cook',           'Line cook',                 'culinary'),
  ('fb_steward',        'Stewarding',                'culinary'),
  ('fb_bar',            'Bar service',               'service'),
  ('fb_waiter',         'Waiter / service',          'service'),
  ('fo_reception',      'Reception',                 'service'),
  ('fo_concierge',      'Concierge / driver',        'service'),
  ('fo_security',       'Security',                  'service'),
  ('spa_therapist',     'Spa therapist',             'service'),
  ('boat_captain',      'Boat captain',              'service'),
  ('lang_en',           'English',                   'language'),
  ('lang_lo',           'Lao',                       'language'),
  ('lang_th',           'Thai',                      'language'),
  ('lang_fr',           'French',                    'language')
ON CONFLICT DO NOTHING;

-- 2. Task catalog — recurring + one-off
CREATE TABLE IF NOT EXISTS ops.task_catalog (
  task_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      bigint NOT NULL DEFAULT 260955,
  task_code        text UNIQUE,                       -- 'HK_DEEP_TENT', 'MNT_AC_FILTER_30D'
  title            text NOT NULL,
  description      text,
  dept_id          uuid REFERENCES ops.departments(dept_id),
  required_skills  text[] DEFAULT '{}'::text[],       -- references ops.skills.code
  duration_minutes integer NOT NULL,
  interval_days    integer,                           -- null = ad-hoc
  scope            text NOT NULL DEFAULT 'property'
                   CHECK (scope IN ('property','room','tent','public_area','equipment','asset')),
  scope_target     text,                              -- 'Tent 4', 'Pool', or asset_id ref
  asset_id         uuid REFERENCES ops.assets(asset_id),  -- when scope='asset'
  priority         smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  parts_needed     jsonb DEFAULT '[]'::jsonb,         -- [{name,qty,sku?}] — FK later
  blocks_room      boolean NOT NULL DEFAULT false,
  preferred_shift_template_id uuid REFERENCES ops.shift_templates(id),
  sop_doc_id       uuid REFERENCES docs.documents(doc_id),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_catalog_dept_idx ON ops.task_catalog (dept_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS task_catalog_recurring_idx ON ops.task_catalog (interval_days) WHERE is_active AND interval_days IS NOT NULL;

-- 3. Task instances — actual scheduled occurrences
CREATE TABLE IF NOT EXISTS ops.task_instances (
  instance_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint NOT NULL DEFAULT 260955,
  task_id         uuid NOT NULL REFERENCES ops.task_catalog(task_id),
  scheduled_date  date NOT NULL,
  scheduled_start time,
  scheduled_end   time,
  assigned_to     uuid REFERENCES ops.staff_employment(id),
  status          text NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','done','skipped','overdue','blocked')),
  actual_start_at timestamptz,
  actual_end_at   timestamptz,
  actual_minutes  integer,
  completed_at    timestamptz,
  completed_by    uuid REFERENCES ops.staff_employment(id),
  notes           text,
  generated_by    text NOT NULL DEFAULT 'manual'
                  CHECK (generated_by IN ('manual','ai_planner','recurring','imported')),
  plan_run_id     uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_instances_date_idx ON ops.task_instances (scheduled_date, status);
CREATE INDEX IF NOT EXISTS task_instances_assigned_idx ON ops.task_instances (assigned_to, scheduled_date);
CREATE INDEX IF NOT EXISTS task_instances_task_idx ON ops.task_instances (task_id, scheduled_date DESC);

-- 4. Plan runs — audit trail of each AI-generated week plan
CREATE TABLE IF NOT EXISTS ops.plan_runs (
  plan_run_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint NOT NULL DEFAULT 260955,
  week_start      date NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  generated_by    uuid REFERENCES auth.users(id),
  agent_code      text,                              -- 'rota_agent','housekeeping_agent'
  occupancy_input jsonb,                             -- forecast snapshot
  decisions       jsonb,                             -- full plan output
  conflicts       jsonb DEFAULT '[]'::jsonb,         -- couldn't-assign list
  approved        boolean DEFAULT false,
  approved_at     timestamptz,
  approved_by     uuid REFERENCES auth.users(id),
  notes           text
);

CREATE INDEX IF NOT EXISTS plan_runs_week_idx ON ops.plan_runs (property_id, week_start DESC);

-- FK from instances to runs
ALTER TABLE ops.task_instances
  ADD CONSTRAINT task_instances_plan_run_fk
  FOREIGN KEY (plan_run_id) REFERENCES ops.plan_runs(plan_run_id) ON DELETE SET NULL;
