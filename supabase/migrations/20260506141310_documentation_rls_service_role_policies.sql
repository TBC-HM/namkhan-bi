-- Documentation schemas — service_role RLS allow-all policies.
-- Purpose: with RLS enabled but no policies, PostgREST returned null for
--          rows in non-public schemas even via service_role. Add explicit
--          allow-all policies for service_role on every documentation table.
-- Method:  iterate schemas + tables, CREATE POLICY service_role_all FOR ALL.
-- Note:    ai_agent and promotion_service roles are NOT yet created
--          (deferred — see ADR 0004). Today only service_role writes.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: documentation_rls_service_role_policies).

DO $$
DECLARE
  schemas TEXT[] := ARRAY['documentation_staging', 'documentation'];
  schema_name TEXT;
  table_name TEXT;
BEGIN
  FOREACH schema_name IN ARRAY schemas LOOP
    FOR table_name IN
      SELECT tablename FROM pg_tables WHERE schemaname = schema_name
    LOOP
      BEGIN
        EXECUTE format('CREATE POLICY service_role_all ON %I.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', schema_name, table_name);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END LOOP;
  END LOOP;
END $$;
