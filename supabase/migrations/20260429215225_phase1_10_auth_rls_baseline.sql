-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429215225
-- Name:    phase1_10_auth_rls_baseline
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.10 — Auth + baseline RLS policies for owner role
-- Enables v9 frontend to use Supabase Auth, not Vercel auth.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions for RLS
-- ---------------------------------------------------------------------

-- Returns true if the calling user has any of the given role codes
CREATE OR REPLACE FUNCTION app.has_role(role_codes text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.user_roles ur
    JOIN app.roles r ON r.role_id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      AND r.code = ANY(role_codes)
  );
$$;

-- Returns true if the calling user is owner or gm (top-level)
CREATE OR REPLACE FUNCTION app.is_top_level()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT app.has_role(ARRAY['owner','gm']);
$$;

-- Returns the calling user's department codes (HoD/supervisor/line_staff scoping)
CREATE OR REPLACE FUNCTION app.my_dept_codes()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(array_agg(DISTINCT dept_code) FILTER (WHERE dept_code IS NOT NULL), '{}')
  FROM app.user_roles
  WHERE user_id = auth.uid() AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION app.has_role(text[])    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app.is_top_level()      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app.my_dept_codes()     TO authenticated, anon;

-- ---------------------------------------------------------------------
-- app.profiles — own row + top-level read all
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_self_read   ON app.profiles;
DROP POLICY IF EXISTS profiles_self_update ON app.profiles;
DROP POLICY IF EXISTS profiles_top_read    ON app.profiles;
DROP POLICY IF EXISTS profiles_top_write   ON app.profiles;

CREATE POLICY profiles_self_read   ON app.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY profiles_self_update ON app.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_top_read    ON app.profiles
  FOR SELECT TO authenticated
  USING (app.is_top_level());

CREATE POLICY profiles_top_write   ON app.profiles
  FOR ALL TO authenticated
  USING (app.is_top_level())
  WITH CHECK (app.is_top_level());

-- ---------------------------------------------------------------------
-- app.roles + app.permissions — read for everyone authenticated, write only top-level
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS roles_read       ON app.roles;
DROP POLICY IF EXISTS roles_top_write  ON app.roles;
CREATE POLICY roles_read       ON app.roles      FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_top_write  ON app.roles      FOR ALL    TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

DROP POLICY IF EXISTS perms_read       ON app.permissions;
DROP POLICY IF EXISTS perms_top_write  ON app.permissions;
CREATE POLICY perms_read       ON app.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY perms_top_write  ON app.permissions FOR ALL    TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- ---------------------------------------------------------------------
-- app.user_roles — read own + top-level full
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS ur_self_read  ON app.user_roles;
DROP POLICY IF EXISTS ur_top_all    ON app.user_roles;
CREATE POLICY ur_self_read ON app.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ur_top_all   ON app.user_roles FOR ALL    TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- ---------------------------------------------------------------------
-- app.tasks — own + assigned + watcher + top-level
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS tasks_read   ON app.tasks;
DROP POLICY IF EXISTS tasks_write  ON app.tasks;
DROP POLICY IF EXISTS tasks_top    ON app.tasks;
CREATE POLICY tasks_read  ON app.tasks FOR SELECT TO authenticated
  USING ( assigned_to = auth.uid()
       OR created_by  = auth.uid()
       OR auth.uid() = ANY(watchers)
       OR app.is_top_level()
       OR (dept_code IS NOT NULL AND dept_code = ANY(app.my_dept_codes())));
CREATE POLICY tasks_write ON app.tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR app.is_top_level());
CREATE POLICY tasks_top   ON app.tasks FOR UPDATE TO authenticated USING (app.is_top_level() OR assigned_to = auth.uid() OR created_by = auth.uid())
                                                  WITH CHECK       (app.is_top_level() OR assigned_to = auth.uid() OR created_by = auth.uid());

-- ---------------------------------------------------------------------
-- app.audit_log — read top-level only (sensitive)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS audit_top ON app.audit_log;
CREATE POLICY audit_top ON app.audit_log FOR SELECT TO authenticated USING (app.is_top_level());

-- ---------------------------------------------------------------------
-- app.api_keys — top-level only (anyone with this list = full system access)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS apikeys_top ON app.api_keys;
CREATE POLICY apikeys_top ON app.api_keys FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- ---------------------------------------------------------------------
-- app.notifications — own only
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS notif_own ON app.notifications;
CREATE POLICY notif_own ON app.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- app.media — read all authenticated, write top-level + creator
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS media_read  ON app.media;
DROP POLICY IF EXISTS media_write ON app.media;
CREATE POLICY media_read  ON app.media FOR SELECT TO authenticated USING (true);
CREATE POLICY media_write ON app.media FOR ALL    TO authenticated USING (app.is_top_level() OR uploaded_by = auth.uid())
                                                  WITH CHECK       (app.is_top_level() OR uploaded_by = auth.uid());

-- ---------------------------------------------------------------------
-- docs.documents — sensitivity-based + top-level full
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS docs_read   ON docs.documents;
DROP POLICY IF EXISTS docs_top    ON docs.documents;
DROP POLICY IF EXISTS docs_owner  ON docs.documents;

CREATE POLICY docs_read ON docs.documents FOR SELECT TO authenticated
  USING (
       sensitivity = 'public'
    OR sensitivity = 'internal'
    OR owner_user_id = auth.uid()
    OR app.is_top_level()
    OR (sensitivity = 'confidential' AND app.has_role(ARRAY['owner','gm','hod','auditor']))
  );

CREATE POLICY docs_top ON docs.documents FOR ALL TO authenticated
  USING (app.is_top_level() OR owner_user_id = auth.uid())
  WITH CHECK (app.is_top_level() OR owner_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- governance schema — read all authenticated, write top-level
-- (proposals stay readable so HoDs see what's pending)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT relname FROM pg_stat_user_tables WHERE schemaname = 'governance'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS gov_read ON governance.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS gov_top  ON governance.%I;', t);
    EXECUTE format('CREATE POLICY gov_read ON governance.%I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY gov_top  ON governance.%I FOR ALL    TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());', t);
  END LOOP;
END$$;

-- ---------------------------------------------------------------------
-- ops, fb, spa, activities, knowledge, training, guest — read all authenticated, write top-level (per-page tightening later)
-- ---------------------------------------------------------------------
DO $$
DECLARE s text; t text;
BEGIN
  FOREACH s IN ARRAY ARRAY['ops','fb','spa','activities','knowledge','training','guest']
  LOOP
    FOR t IN SELECT relname FROM pg_stat_user_tables WHERE schemaname = s
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I.%I;', s, s, t);
      EXECUTE format('DROP POLICY IF EXISTS %I_top  ON %I.%I;', s, s, t);
      EXECUTE format('CREATE POLICY %I_read ON %I.%I FOR SELECT TO authenticated USING (true);', s, s, t);
      EXECUTE format('CREATE POLICY %I_top  ON %I.%I FOR ALL    TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());', s, s, t);
    END LOOP;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------
-- public.* + plan.* — read for authenticated (existing data is non-sensitive ops data)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT relname FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname NOT LIKE 'mv_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_read ON public.%I;', t);
    EXECUTE format('CREATE POLICY public_read ON public.%I FOR SELECT TO authenticated USING (true);', t);
  END LOOP;
  FOR t IN SELECT relname FROM pg_stat_user_tables WHERE schemaname = 'plan'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS plan_read ON plan.%I;', t);
    EXECUTE format('CREATE POLICY plan_read ON plan.%I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS plan_top  ON plan.%I;', t);
    EXECUTE format('CREATE POLICY plan_top  ON plan.%I FOR ALL    TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());', t);
  END LOOP;
END$$;

-- Public materialized views — grant SELECT to authenticated
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- ---------------------------------------------------------------------
-- Auto-create profile when a new user signs up via Supabase Auth
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO app.profiles (user_id, email, full_name, language_pref, is_active, joined_at, created_by, updated_by)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
          COALESCE(NEW.raw_user_meta_data->>'language_pref', 'en'),
          true, current_date, NEW.id, NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();

COMMENT ON FUNCTION app.has_role(text[]) IS 'RLS helper: does auth.uid() have any of the given role codes?';
COMMENT ON FUNCTION app.is_top_level() IS 'RLS helper: owner or gm';
COMMENT ON FUNCTION app.handle_new_user() IS 'Auto-creates app.profiles row on auth signup. No role granted — owner must assign.';
