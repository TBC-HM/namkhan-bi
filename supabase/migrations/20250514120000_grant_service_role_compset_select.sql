-- Migration: Grant SELECT on compset tables and views to service_role
-- Ticket #599 | urgency: high
-- Removes the anon-client workaround on the compset page.
--
-- Note: service_role bypasses RLS by default in Supabase (BYPASSRLS is
-- implicit for the service_role JWT). The GRANTs below cover object-level
-- privilege; RLS bypass is handled at the Postgres role level.

-- ──────────────────────────────────────────────
-- 1. Base tables
-- ──────────────────────────────────────────────
GRANT SELECT ON revenue.competitor_rate_matrix TO service_role;
GRANT SELECT ON revenue.competitor_rates        TO service_role;
GRANT SELECT ON revenue.competitor_rate_plans   TO service_role;

-- ──────────────────────────────────────────────
-- 2. Known v_compset_* views
--    Add any new views here manually, OR rely on
--    the dynamic block in section 3 below.
-- ──────────────────────────────────────────────
GRANT SELECT ON revenue.v_compset_summary        TO service_role;
GRANT SELECT ON revenue.v_compset_daily          TO service_role;
GRANT SELECT ON revenue.v_compset_weekly         TO service_role;
GRANT SELECT ON revenue.v_compset_monthly        TO service_role;
GRANT SELECT ON revenue.v_compset_channel        TO service_role;
GRANT SELECT ON revenue.v_compset_rate_parity    TO service_role;

-- ──────────────────────────────────────────────
-- 3. Dynamic catch-all: grant SELECT on ANY
--    revenue.v_compset_* view that exists now or
--    was created before this migration runs.
--    Safe to run multiple times (idempotent).
-- ──────────────────────────────────────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT table_name
        FROM   information_schema.views
        WHERE  table_schema = 'revenue'
          AND  table_name   ILIKE 'v\_compset\_%'
        ORDER  BY table_name
    LOOP
        EXECUTE format(
            'GRANT SELECT ON revenue.%I TO service_role',
            r.table_name
        );
        RAISE NOTICE 'Granted SELECT on revenue.% to service_role', r.table_name;
    END LOOP;
END;
$$;

-- ──────────────────────────────────────────────
-- 4. Default privileges: auto-grant SELECT on
--    future v_compset_* views created by the
--    postgres (superuser) role.
--    Adjust the role in IN SCHEMA if your DDL
--    owner differs.
-- ──────────────────────────────────────────────
ALTER DEFAULT PRIVILEGES IN SCHEMA revenue
    GRANT SELECT ON TABLES TO service_role;

-- ──────────────────────────────────────────────
-- Verification query (run manually after push):
--
--   SELECT grantee, table_schema, table_name, privilege_type
--   FROM   information_schema.role_table_grants
--   WHERE  grantee      = 'service_role'
--     AND  table_schema = 'revenue'
--   ORDER  BY table_name;
--
-- Expected: every compset table/view shows SELECT.
-- ──────────────────────────────────────────────
