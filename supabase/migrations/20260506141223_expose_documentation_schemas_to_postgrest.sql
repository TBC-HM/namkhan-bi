-- Expose documentation schemas to PostgREST.
-- Purpose: enable supabase-js .schema('documentation') and .schema('documentation_staging')
--          calls from API routes. Without this, queries return null silently.
-- Method:  ALTER ROLE authenticator SET pgrst.db_schemas — MERGE with existing list,
--          NEVER overwrite (per KB rule "pgrst.db_schemas merge never overwrite").
-- Note:    Existing list at time of migration was preserved verbatim and the
--          two new schemas appended.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: expose_documentation_schemas_to_postgrest).

ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, marketing, ops, gl, suppliers, fa, inv, proc, frontoffice, revenue, kpi, governance, guest, sales, pricing, pos, documentation, documentation_staging';
NOTIFY pgrst, 'reload config';

GRANT USAGE ON SCHEMA documentation TO service_role, authenticated, anon;
GRANT USAGE ON SCHEMA documentation_staging TO service_role, authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA documentation TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA documentation_staging TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA documentation TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA documentation_staging TO service_role;
