-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506101437
-- Name:    anon_select_pricing_parity
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Pricing page: needs SELECT on rate_plans + room_types via anon
DROP POLICY IF EXISTS anon_read ON public.rate_plans;
CREATE POLICY anon_read ON public.rate_plans FOR SELECT TO anon, authenticated, service_role USING (true);

DROP POLICY IF EXISTS anon_read ON public.room_types;
CREATE POLICY anon_read ON public.room_types FOR SELECT TO anon, authenticated, service_role USING (true);

DROP POLICY IF EXISTS anon_read ON public.sources;
CREATE POLICY anon_read ON public.sources FOR SELECT TO anon, authenticated, service_role USING (true);

-- Parity page: needs SELECT on revenue.parity_breaches + parity_observations
DROP POLICY IF EXISTS anon_read ON revenue.parity_breaches;
CREATE POLICY anon_read ON revenue.parity_breaches FOR SELECT TO anon, authenticated, service_role USING (true);

DROP POLICY IF EXISTS anon_read ON revenue.parity_observations;
CREATE POLICY anon_read ON revenue.parity_observations FOR SELECT TO anon, authenticated, service_role USING (true);

-- Agents tables for run history
DO $$
DECLARE has_table boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='agents') INTO has_table;
  IF has_table THEN
    EXECUTE 'ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS anon_read ON public.agents';
    EXECUTE 'CREATE POLICY anon_read ON public.agents FOR SELECT TO anon, authenticated, service_role USING (true)';
  END IF;
  SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='agent_runs') INTO has_table;
  IF has_table THEN
    EXECUTE 'ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS anon_read ON public.agent_runs';
    EXECUTE 'CREATE POLICY anon_read ON public.agent_runs FOR SELECT TO anon, authenticated, service_role USING (true)';
  END IF;
END $$;