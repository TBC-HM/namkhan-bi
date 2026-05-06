-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155306
-- Name:    multitenant_phase_2_2_jwt_helpers
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.2 — JWT helper functions for tenant-isolated RLS
-- =====================================================================

-- Returns the bigint[] of property_ids the current JWT can access.
-- Reads from app_metadata.property_ids (set by Auth Hook at login).
-- Falls back to user_properties lookup if claim is missing (slower, defensive).
CREATE OR REPLACE FUNCTION core.current_property_ids()
RETURNS BIGINT[]
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  jwt_claims jsonb;
  ids        bigint[];
BEGIN
  -- 1. Try the fast path: claim baked into JWT app_metadata
  jwt_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;

  IF jwt_claims IS NOT NULL THEN
    SELECT ARRAY(
      SELECT (jsonb_array_elements_text(
        COALESCE(jwt_claims -> 'app_metadata' -> 'property_ids', '[]'::jsonb)
      ))::BIGINT
    )
    INTO ids;

    IF array_length(ids, 1) IS NOT NULL THEN
      RETURN ids;
    END IF;
  END IF;

  -- 2. Fallback: query user_properties using sub claim
  IF jwt_claims IS NOT NULL AND jwt_claims ? 'sub' THEN
    RETURN ARRAY(
      SELECT property_id
      FROM core.user_properties
      WHERE user_id = (jwt_claims ->> 'sub')::uuid
    );
  END IF;

  RETURN ARRAY[]::BIGINT[];
END $$;

-- Convenience: does the current JWT have access to property p?
CREATE OR REPLACE FUNCTION core.has_property_access(p BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p = ANY(core.current_property_ids());
$$;

-- Role check helper (for finer-grained policies later)
CREATE OR REPLACE FUNCTION core.current_role_for_property(p BIGINT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  jwt_claims jsonb;
  user_id    uuid;
  r          text;
BEGIN
  jwt_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF jwt_claims IS NULL OR NOT (jwt_claims ? 'sub') THEN
    RETURN NULL;
  END IF;
  user_id := (jwt_claims ->> 'sub')::uuid;

  SELECT role INTO r
  FROM core.user_properties
  WHERE user_properties.user_id = current_role_for_property.user_id
    AND user_properties.property_id = p;

  RETURN r;
END $$;

-- Permissions
GRANT EXECUTE ON FUNCTION core.current_property_ids()        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.has_property_access(BIGINT)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.current_role_for_property(BIGINT) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- RLS on core tables
-- ---------------------------------------------------------------------

-- core.properties — users see only properties they have access to
CREATE POLICY properties_tenant_read ON core.properties
  FOR SELECT TO authenticated
  USING (core.has_property_access(property_id));

CREATE POLICY properties_service_all ON core.properties
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- core.user_properties — users see only their own row(s)
CREATE POLICY user_properties_self_read ON core.user_properties
  FOR SELECT TO authenticated
  USING (
    user_id = (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid
  );

CREATE POLICY user_properties_service_all ON core.user_properties
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- core.pms_credentials — already locked to service_role via REVOKE; explicit policy
CREATE POLICY pms_credentials_service_only ON core.pms_credentials
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION core.current_property_ids() IS 'Returns BIGINT[] of property_ids the current JWT can access. Reads app_metadata.property_ids; falls back to core.user_properties lookup.';
COMMENT ON FUNCTION core.has_property_access(BIGINT) IS 'True if current JWT can access the given property_id. Use in RLS USING/WITH CHECK clauses.';
