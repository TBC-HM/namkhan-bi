-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505130219
-- Name:    security_fix_views_to_invoker_safe_batch_v2_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Audit finding 2026-05-05: SECURITY DEFINER views flagged as ERROR by advisor.
-- Flips views (NOT materialized views — Postgres doesn't accept the option there)
-- in non-sensitive schemas to security_invoker = on, excluding views that
-- reference RLS-sensitive tables (docs.*, governance.*, storage.objects, etc.).
--
-- Reversal: ALTER VIEW ... RESET (security_invoker);

DO $$
DECLARE
  rec RECORD;
  excluded TEXT[] := ARRAY[
    'gl.v_ops_snapshot',
    'ops.v_staff_last_payslip',
    'public.v_alerts_open',
    'public.v_compset_agent_settings',
    'public.v_decisions_booking_com',
    'public.v_decisions_queued_top',
    'public.v_dmc_contracts',
    'public.v_dmc_reservation_mapping',
    'public.v_knowledge_overview'
  ];
  fqn TEXT;
  cnt INT := 0;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema_name, c.relname AS object_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v'  -- views only, not matviews
      AND n.nspname IN ('kpi','gl','public','marketing','dq','fa','inv','ops','proc','guest','auth_ext','catalog')
      AND (c.reloptions IS NULL OR NOT (c.reloptions::text ILIKE '%security_invoker%'))
  LOOP
    fqn := rec.schema_name || '.' || rec.object_name;
    IF fqn = ANY(excluded) THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = on)', rec.schema_name, rec.object_name);
    cnt := cnt + 1;
  END LOOP;
  RAISE NOTICE 'Flipped % views to security_invoker', cnt;
END $$;
