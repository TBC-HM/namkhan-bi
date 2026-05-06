-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503192909
-- Name:    compset_settings_pages_prereqs_v3
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- 1. activate_scoring_config
CREATE OR REPLACE FUNCTION revenue.activate_scoring_config(
  p_config_id UUID, p_reason TEXT, p_user UUID DEFAULT NULL
) RETURNS revenue.scoring_config
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, revenue
AS $$
DECLARE v_old_id UUID; v_new_row revenue.scoring_config; v_target_version INT;
BEGIN
  SELECT config_id INTO v_old_id FROM revenue.scoring_config WHERE is_active = true LIMIT 1;
  IF v_old_id = p_config_id THEN RAISE EXCEPTION 'config_id % is already active', p_config_id; END IF;
  SELECT version INTO v_target_version FROM revenue.scoring_config WHERE config_id = p_config_id;
  IF v_target_version IS NULL THEN RAISE EXCEPTION 'config_id % does not exist', p_config_id; END IF;
  IF v_old_id IS NOT NULL THEN
    UPDATE revenue.scoring_config SET is_active = false, retired_at = NOW() WHERE config_id = v_old_id;
  END IF;
  UPDATE revenue.scoring_config SET is_active = true, activated_at = NOW()
   WHERE config_id = p_config_id RETURNING * INTO v_new_row;
  INSERT INTO revenue.scoring_config_audit (config_id, version, action, changed_by, reason, diff)
  VALUES (p_config_id, v_target_version, 'activated', p_user,
          COALESCE(NULLIF(TRIM(p_reason), ''), 'no reason given'),
          jsonb_build_object('previous_active_config_id', v_old_id));
  RETURN v_new_row;
END;$$;
REVOKE ALL ON FUNCTION revenue.activate_scoring_config(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revenue.activate_scoring_config(UUID, TEXT, UUID) TO service_role, authenticated;

-- 2. public proxy
CREATE OR REPLACE FUNCTION public.compset_activate_scoring_config(p_config_id UUID, p_reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, revenue
AS $$
DECLARE v_row revenue.scoring_config;
BEGIN
  v_row := revenue.activate_scoring_config(p_config_id, p_reason, auth.uid());
  RETURN v_row.config_id;
END;$$;
REVOKE ALL ON FUNCTION public.compset_activate_scoring_config(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compset_activate_scoring_config(UUID, TEXT) TO service_role, authenticated;

-- 3. create draft
CREATE OR REPLACE FUNCTION public.compset_create_scoring_config_draft(
  p_weight_dow NUMERIC, p_weight_event NUMERIC, p_weight_lead_time NUMERIC, p_weight_peak_bonus NUMERIC,
  p_dow_scores JSONB, p_lead_time_bands JSONB, p_notes TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, revenue
AS $$
DECLARE v_next_version INT; v_id UUID; v_sum NUMERIC;
BEGIN
  v_sum := COALESCE(p_weight_dow,0) + COALESCE(p_weight_event,0) + COALESCE(p_weight_lead_time,0) + COALESCE(p_weight_peak_bonus,0);
  IF v_sum < 0.99 OR v_sum > 1.01 THEN RAISE EXCEPTION 'weights must sum to 1.0 (got %)', v_sum; END IF;
  IF jsonb_typeof(p_dow_scores) <> 'object' THEN RAISE EXCEPTION 'dow_scores must be a JSON object'; END IF;
  IF jsonb_typeof(p_lead_time_bands) <> 'array' THEN RAISE EXCEPTION 'lead_time_bands must be a JSON array'; END IF;
  SELECT COALESCE(MAX(version),0) + 1 INTO v_next_version FROM revenue.scoring_config;
  INSERT INTO revenue.scoring_config (
    version, is_active, weight_dow, weight_event, weight_lead_time, weight_peak_bonus,
    dow_scores, lead_time_bands, notes, created_by
  ) VALUES (
    v_next_version, false, p_weight_dow, p_weight_event, p_weight_lead_time, p_weight_peak_bonus,
    p_dow_scores, p_lead_time_bands, NULLIF(TRIM(p_notes), ''), auth.uid()
  ) RETURNING config_id INTO v_id;
  RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.compset_create_scoring_config_draft(NUMERIC,NUMERIC,NUMERIC,NUMERIC,JSONB,JSONB,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compset_create_scoring_config_draft(NUMERIC,NUMERIC,NUMERIC,NUMERIC,JSONB,JSONB,TEXT) TO service_role, authenticated;

-- 4. read proxy views
CREATE OR REPLACE VIEW public.v_compset_scoring_config AS
SELECT config_id, version, is_active, weight_dow, weight_event, weight_lead_time, weight_peak_bonus,
       dow_scores, lead_time_bands, notes, created_by, created_at, activated_at, retired_at
FROM revenue.scoring_config;

CREATE OR REPLACE VIEW public.v_compset_scoring_config_audit AS
SELECT audit_id, config_id, version, action, changed_by, changed_at, reason, diff
FROM revenue.scoring_config_audit;

CREATE OR REPLACE VIEW public.v_compset_event_types AS
SELECT type_code, display_name, category, default_demand_score,
       marketing_lead_days_min, marketing_lead_days_max,
       scrape_lead_days_min, scrape_lead_days_max,
       default_source_markets, notes
FROM marketing.calendar_event_types;

-- agent settings: just expose existing governance view via public alias
CREATE OR REPLACE VIEW public.v_compset_agent_settings AS
SELECT agent_id, code, name, status, pillar, runtime_settings, locked_by_mandate
FROM governance.agent_settings_for_rm;

GRANT SELECT ON public.v_compset_scoring_config       TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_scoring_config_audit TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_event_types          TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_agent_settings       TO anon, authenticated, service_role;

-- 5. update agent runtime
CREATE OR REPLACE FUNCTION public.compset_update_agent_runtime(p_agent_code TEXT, p_runtime_settings JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, governance
AS $$
DECLARE v_old JSONB; v_new JSONB;
BEGIN
  IF jsonb_typeof(p_runtime_settings) <> 'object' THEN RAISE EXCEPTION 'runtime_settings must be a JSON object'; END IF;
  SELECT runtime_settings INTO v_old FROM governance.agents WHERE code = p_agent_code;
  IF v_old IS NULL THEN RAISE EXCEPTION 'agent % not found', p_agent_code; END IF;
  UPDATE governance.agents SET runtime_settings = p_runtime_settings, updated_at = NOW()
   WHERE code = p_agent_code RETURNING runtime_settings INTO v_new;
  RETURN v_new;
END;$$;
REVOKE ALL ON FUNCTION public.compset_update_agent_runtime(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compset_update_agent_runtime(TEXT, JSONB) TO service_role, authenticated;

NOTIFY pgrst, 'reload schema';
