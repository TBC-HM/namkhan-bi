-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503201326
-- Name:    compset_agent_helpers
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- compset_run_create: insert agent_runs row + return run_id
CREATE OR REPLACE FUNCTION public.compset_run_create(p_input JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, governance
AS $$
DECLARE v_id UUID; v_agent_id UUID;
BEGIN
  SELECT agent_id INTO v_agent_id FROM governance.agents WHERE code = 'compset_agent';
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'compset_agent not found'; END IF;
  INSERT INTO governance.agent_runs (agent_id, started_at, status, input)
  VALUES (v_agent_id, NOW(), 'running', COALESCE(p_input, '{}'::jsonb))
  RETURNING run_id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.compset_run_create(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compset_run_create(JSONB) TO service_role;

-- compset_run_finish: update status + counts + cost
CREATE OR REPLACE FUNCTION public.compset_run_finish(
  p_run_id UUID, p_status TEXT, p_output JSONB,
  p_duration_ms INT, p_cost_usd NUMERIC
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, governance
AS $$
BEGIN
  UPDATE governance.agent_runs
     SET finished_at = NOW(),
         status = p_status,
         output = p_output,
         duration_ms = p_duration_ms,
         cost_usd = p_cost_usd,
         budget_used_usd = p_cost_usd
   WHERE run_id = p_run_id;
END;
$$;
REVOKE ALL ON FUNCTION public.compset_run_finish(UUID, TEXT, JSONB, INT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compset_run_finish(UUID, TEXT, JSONB, INT, NUMERIC) TO service_role;

-- compset_log_rate: insert one observation into revenue.competitor_rates
-- (also pushes review snapshot if review_score provided)
CREATE OR REPLACE FUNCTION public.compset_log_rate(p JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, revenue
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO revenue.competitor_rates (
    comp_id, stay_date, shop_date, channel, los_nights, geo_market,
    rate_usd, native_rate, native_currency, currency,
    is_available, is_refundable, room_type, mealplan,
    scrape_status, agent_run_id, raw, source
  ) VALUES (
    (p->>'comp_id')::uuid,
    (p->>'stay_date')::date,
    (p->>'shop_date')::date,
    p->>'channel',
    COALESCE((p->>'los_nights')::smallint, 1),
    COALESCE(p->>'geo_market', 'US'),
    (p->>'rate_usd')::numeric,
    (p->>'native_rate')::numeric,
    COALESCE(p->>'native_currency', 'USD'),
    COALESCE(p->>'currency', 'USD'),
    (p->>'is_available')::boolean,
    (p->>'is_refundable')::boolean,
    p->>'room_type',
    p->>'mealplan',
    COALESCE(p->>'scrape_status', 'success'),
    (p->>'agent_run_id')::uuid,
    COALESCE(p->'raw', '{}'::jsonb),
    COALESCE(p->>'source', 'nimble')
  ) RETURNING rate_id INTO v_id;

  IF (p ? 'review_score') AND (p->>'review_score') IS NOT NULL THEN
    INSERT INTO revenue.competitor_reviews (
      comp_id, channel, shop_date, review_score, review_count, agent_run_id
    ) VALUES (
      (p->>'comp_id')::uuid,
      p->>'channel',
      (p->>'shop_date')::date,
      (p->>'review_score')::numeric,
      (p->>'review_count')::int,
      (p->>'agent_run_id')::uuid
    )
    ON CONFLICT (comp_id, channel, shop_date) DO UPDATE
      SET review_score = EXCLUDED.review_score,
          review_count = EXCLUDED.review_count,
          agent_run_id = EXCLUDED.agent_run_id;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.compset_log_rate(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compset_log_rate(JSONB) TO service_role;

-- compset_get_jobs: returns job rows for a given mode/filter (so Edge Function doesn't need revenue schema access)
CREATE OR REPLACE FUNCTION public.compset_get_jobs(
  p_comp_ids UUID[] DEFAULT NULL,
  p_only_primary BOOLEAN DEFAULT TRUE,
  p_only_active BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
  comp_id UUID,
  property_name TEXT,
  is_self BOOLEAN,
  bdc_url TEXT,
  agoda_url TEXT,
  expedia_url TEXT,
  trip_url TEXT,
  direct_url TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, revenue
AS $$
BEGIN
  RETURN QUERY
  SELECT cp.comp_id, cp.property_name, cp.is_self,
         cp.bdc_url, cp.agoda_url, cp.expedia_url, cp.trip_url, cp.direct_url
  FROM revenue.competitor_property cp
  JOIN revenue.competitor_set cs ON cs.set_id = cp.set_id
  WHERE (NOT p_only_primary OR cs.is_primary)
    AND (NOT p_only_active OR cp.is_active)
    AND (p_comp_ids IS NULL OR cp.comp_id = ANY(p_comp_ids))
  ORDER BY cp.is_self DESC NULLS LAST, cp.scrape_priority NULLS LAST, cp.property_name;
END;
$$;
REVOKE ALL ON FUNCTION public.compset_get_jobs(UUID[], BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compset_get_jobs(UUID[], BOOLEAN, BOOLEAN) TO service_role;

NOTIFY pgrst, 'reload schema';
