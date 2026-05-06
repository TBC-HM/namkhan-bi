-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503190938
-- Name:    compset_v3_public_proxies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Public proxy views for /revenue/compset v3 redesign.
-- Reason: PostgREST `pgrst.db_schemas` does not include `revenue` schema.
-- All read-only pass-throughs of the existing revenue.* views.

CREATE OR REPLACE VIEW public.v_compset_set_summary AS
  SELECT * FROM revenue.compset_set_summary;

CREATE OR REPLACE VIEW public.v_compset_property_summary AS
  SELECT * FROM revenue.compset_property_summary;

CREATE OR REPLACE VIEW public.v_compset_data_maturity AS
  SELECT * FROM revenue.data_maturity;

CREATE OR REPLACE VIEW public.v_compset_promo_behavior_signals AS
  SELECT * FROM revenue.promo_behavior_signals;

CREATE OR REPLACE VIEW public.v_compset_rate_plan_gaps AS
  SELECT * FROM revenue.rate_plan_gaps;

CREATE OR REPLACE VIEW public.v_compset_namkhan_vs_comp_avg AS
  SELECT * FROM revenue.namkhan_vs_comp_avg;

CREATE OR REPLACE VIEW public.v_compset_rate_plan_landscape AS
  SELECT * FROM revenue.rate_plan_landscape;

GRANT SELECT ON public.v_compset_set_summary           TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_property_summary      TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_data_maturity         TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_promo_behavior_signals TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_rate_plan_gaps        TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_namkhan_vs_comp_avg   TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_rate_plan_landscape   TO anon, authenticated, service_role;

-- Public RPC wrapper for revenue.pick_scrape_dates (signature uses smallint for p_min_score)
CREATE OR REPLACE FUNCTION public.compset_pick_scrape_dates(
  p_max_dates int DEFAULT 8,
  p_horizon_days int DEFAULT 120,
  p_min_score int DEFAULT 40
)
RETURNS TABLE(
  stay_date date,
  total_score smallint,
  dow_score smallint,
  event_score smallint,
  lead_time_score smallint,
  events text[],
  reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, revenue
AS $$
  SELECT * FROM revenue.pick_scrape_dates(
    p_max_dates,
    p_horizon_days,
    p_min_score::smallint
  );
$$;

GRANT EXECUTE ON FUNCTION public.compset_pick_scrape_dates(int, int, int) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
