-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429210053
-- Name:    phase1_00_app
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.0 — `app` schema
-- Foundation: users (profiles), roles, permissions, audit, api keys,
-- notifications, tasks, media
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS app;
COMMENT ON SCHEMA app IS 'Application layer: users, roles, permissions, audit, tasks, media, notifications';

-- ---------------------------------------------------------------------
-- 1. ROLES (catalog)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.roles (
  role_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text UNIQUE NOT NULL,         -- owner, gm, hod, supervisor, line_staff, auditor, agent, guest
  name           text NOT NULL,
  description    text,
  is_system      boolean DEFAULT false,         -- system roles can't be deleted
  rank           int    DEFAULT 100,            -- lower = higher privilege
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

INSERT INTO app.roles (code, name, description, is_system, rank) VALUES
  ('owner',       'Owner',           'Full access to all properties and modules', true, 10),
  ('gm',          'General Manager', 'Property-wide access, can approve all',     true, 20),
  ('hod',         'Head of Department', 'Department-scoped access',               true, 30),
  ('supervisor',  'Supervisor',      'Read all in dept, write own area',          true, 40),
  ('line_staff',  'Line Staff',      'Read own tasks, write completions',         true, 50),
  ('auditor',     'Auditor',         'Read-only across modules',                  true, 30),
  ('agent',       'AI Agent',        'Service identity for autonomous agents',    true, 35),
  ('guest',       'Guest',           'External: limited self-service surfaces',   true, 90)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. PERMISSIONS (lookup matrix; enforcement in app code)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.permissions (
  perm_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id        uuid NOT NULL REFERENCES app.roles(role_id) ON DELETE CASCADE,
  module         text NOT NULL,                 -- governance | ops | fb | spa | activities | knowledge | training | guest | finance | revenue | docs | app
  scope          text NOT NULL DEFAULT 'all',   -- all | own_dept | own_user
  actions        text[] NOT NULL DEFAULT '{read}'::text[],   -- subset of {read, write, approve, delete, export}
  created_at     timestamptz DEFAULT now(),
  UNIQUE (role_id, module, scope)
);

-- Default permission seed: each role gets baseline read; tighten later per page.
INSERT INTO app.permissions (role_id, module, scope, actions)
SELECT r.role_id, m.module, 'all', ARRAY['read','write','approve','delete','export']
FROM app.roles r
CROSS JOIN (VALUES ('governance'),('ops'),('fb'),('spa'),('activities'),
                   ('knowledge'),('training'),('guest'),('finance'),('revenue'),
                   ('docs'),('app')) AS m(module)
WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;

INSERT INTO app.permissions (role_id, module, scope, actions)
SELECT r.role_id, m.module, 'all', ARRAY['read','write','approve','export']
FROM app.roles r
CROSS JOIN (VALUES ('governance'),('ops'),('fb'),('spa'),('activities'),
                   ('knowledge'),('training'),('guest'),('finance'),('revenue'),
                   ('docs')) AS m(module)
WHERE r.code = 'gm'
ON CONFLICT DO NOTHING;

INSERT INTO app.permissions (role_id, module, scope, actions)
SELECT r.role_id, m.module, 'all', ARRAY['read']
FROM app.roles r
CROSS JOIN (VALUES ('governance'),('ops'),('fb'),('spa'),('activities'),
                   ('knowledge'),('training'),('guest'),('finance'),('revenue'),
                   ('docs')) AS m(module)
WHERE r.code = 'auditor'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. PROFILES (extends auth.users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.profiles (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id        bigint REFERENCES public.hotels(property_id),
  full_name          text,
  preferred_name     text,
  lao_name           text,
  email              text,
  phone              text,
  language_pref      text DEFAULT 'en' CHECK (language_pref IN ('lo','en','fr','th','vi')),
  job_title          text,
  dept_code          text,                          -- soft FK to ops.departments.code (created in next migration)
  reports_to         uuid REFERENCES app.profiles(user_id),
  avatar_media_id    uuid,                          -- soft FK to app.media.media_id
  is_active          boolean DEFAULT true,
  is_service_account boolean DEFAULT false,         -- true for AI agents
  joined_at          date,
  left_at            date,
  raw                jsonb DEFAULT '{}'::jsonb,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  created_by         uuid REFERENCES auth.users(id),
  updated_by         uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_profiles_dept ON app.profiles(dept_code);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON app.profiles(is_active) WHERE is_active = true;

-- ---------------------------------------------------------------------
-- 4. USER_ROLES (multi-role, dept-scoped)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.user_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id      uuid NOT NULL REFERENCES app.roles(role_id) ON DELETE RESTRICT,
  property_id  bigint REFERENCES public.hotels(property_id),
  dept_code    text,                                 -- nullable: HoD scoping
  granted_by   uuid REFERENCES auth.users(id),
  granted_at   timestamptz DEFAULT now(),
  expires_at   timestamptz,
  is_active    boolean DEFAULT true,
  UNIQUE (user_id, role_id, property_id, dept_code)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON app.user_roles(user_id) WHERE is_active = true;

-- ---------------------------------------------------------------------
-- 5. AUDIT_LOG (every meaningful write)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.audit_log (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id),
  service_name text,                                 -- when not a user (Make, agent, sync)
  schema_name  text,
  table_name   text NOT NULL,
  row_pk       text,
  action       text NOT NULL CHECK (action IN ('insert','update','delete','approve','reject','login','logout','export','share')),
  before       jsonb,
  after        jsonb,
  diff         jsonb,
  ip           inet,
  user_agent   text,
  request_id   text,
  at           timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON app.audit_log(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON app.audit_log(user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table ON app.audit_log(table_name, row_pk);

-- ---------------------------------------------------------------------
-- 6. API_KEYS (service tokens for Make / agents / webhooks)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.api_keys (
  key_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text NOT NULL,
  hashed_key    text NOT NULL UNIQUE,
  prefix        text NOT NULL,                       -- first 8 chars for UI display
  scopes        text[] NOT NULL DEFAULT '{read}'::text[],
  property_id   bigint REFERENCES public.hotels(property_id),
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  expires_at    timestamptz,
  last_used_at  timestamptz,
  last_used_ip  inet,
  revoked_at    timestamptz,
  revoked_by    uuid REFERENCES auth.users(id),
  notes         text
);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON app.api_keys(prefix) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- 7. NOTIFICATIONS (in-app + email/WA queue)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id   bigint REFERENCES public.hotels(property_id),
  kind          text NOT NULL,                       -- proposal_pending | doc_expiring | task_due | mandate_breach | etc.
  severity      text DEFAULT 'info' CHECK (severity IN ('info','warn','error','critical')),
  title         text NOT NULL,
  body          text,
  link          text,                                -- frontend route
  channel       text[] DEFAULT '{in_app}'::text[],   -- in_app | email | whatsapp | sms
  metadata      jsonb DEFAULT '{}'::jsonb,
  scheduled_for timestamptz DEFAULT now(),
  sent_at       timestamptz,
  read_at       timestamptz,
  dismissed_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON app.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notif_pending ON app.notifications(scheduled_for) WHERE sent_at IS NULL;

-- ---------------------------------------------------------------------
-- 8. MEDIA (images, video, icons used across the system)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.media (
  media_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    bigint REFERENCES public.hotels(property_id),
  kind           text NOT NULL CHECK (kind IN ('image','video','icon','pictogram','audio','3d')),
  storage_bucket text NOT NULL DEFAULT 'media',
  storage_path   text NOT NULL,
  external_url   text,                               -- when stored elsewhere (Drive)
  mime           text,
  file_size_bytes bigint,
  width          int,
  height         int,
  duration_sec   numeric,
  alt_text_en    text,
  alt_text_lo    text,
  caption        text,
  tags           text[] DEFAULT '{}'::text[],
  is_public      boolean DEFAULT true,
  uploaded_by    uuid REFERENCES auth.users(id),
  uploaded_at    timestamptz DEFAULT now(),
  raw            jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_media_kind ON app.media(kind);
CREATE INDEX IF NOT EXISTS idx_media_tags ON app.media USING gin(tags);

-- ---------------------------------------------------------------------
-- 9. TASKS (operational records — separate from documents)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.tasks (
  task_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id        bigint REFERENCES public.hotels(property_id),
  title              text NOT NULL,
  body_markdown      text,
  source_type        text CHECK (source_type IN ('meeting_note','sop','audit','proposal','manual','agent','recommendation','dq','external')),
  source_doc_id      uuid,                            -- soft FK to docs.documents
  source_proposal_id uuid,                            -- soft FK to governance.proposals
  source_external_ref text,                           -- e.g. Cloudbeds reservation link, email msg id
  dept_code          text,
  assigned_to        uuid REFERENCES auth.users(id),
  assigned_by        uuid REFERENCES auth.users(id),
  watchers           uuid[] DEFAULT '{}'::uuid[],
  priority           text DEFAULT 'med' CHECK (priority IN ('low','med','high','urgent')),
  status             text DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled','deferred')),
  due_at             timestamptz,
  started_at         timestamptz,
  completed_at       timestamptz,
  completed_by       uuid REFERENCES auth.users(id),
  evidence_doc_id    uuid,                            -- soft FK to docs.documents
  parent_task_id     uuid REFERENCES app.tasks(task_id),
  est_minutes        int,
  actual_minutes     int,
  tags               text[] DEFAULT '{}'::text[],
  raw                jsonb DEFAULT '{}'::jsonb,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  created_by         uuid REFERENCES auth.users(id),
  updated_by         uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON app.tasks(assigned_to, status) WHERE status NOT IN ('done','cancelled');
CREATE INDEX IF NOT EXISTS idx_tasks_due ON app.tasks(due_at) WHERE status NOT IN ('done','cancelled');
CREATE INDEX IF NOT EXISTS idx_tasks_dept ON app.tasks(dept_code, status);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON app.tasks(source_type, source_doc_id);

CREATE TABLE IF NOT EXISTS app.task_comments (
  id           bigserial PRIMARY KEY,
  task_id      uuid NOT NULL REFERENCES app.tasks(task_id) ON DELETE CASCADE,
  author_id    uuid REFERENCES auth.users(id),
  body         text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  edited_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON app.task_comments(task_id, created_at);

-- ---------------------------------------------------------------------
-- 10. RLS — enable but no policies yet (service role bypasses)
-- ---------------------------------------------------------------------
ALTER TABLE app.roles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.permissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.api_keys              ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.media                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.task_comments         ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 11. updated_at trigger function (reusable)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON app.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON app.profiles
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated ON app.tasks;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON app.tasks
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

DROP TRIGGER IF EXISTS trg_roles_updated ON app.roles;
CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON app.roles
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ---------------------------------------------------------------------
-- 12. Grants
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA app TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA app TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA app TO service_role;
GRANT EXECUTE ON FUNCTION app.set_updated_at() TO service_role, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON SEQUENCES TO service_role;

COMMENT ON TABLE app.profiles IS 'Hotel-specific extension of auth.users';
COMMENT ON TABLE app.tasks IS 'Operational tasks — distinct from docs.documents';
COMMENT ON TABLE app.audit_log IS 'Universal write audit. Populated by app code, not triggers.';
