-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503184624
-- Name:    flag_detector_other_dimensions
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- DETECTOR: rate plan dimension
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.fn_detect_rate_plan_flags(p_run_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0; v_total INT := 0;
BEGIN
  -- plan_new_appearance: taxonomy_code seen for first time on this comp in last 14 days
  WITH new_observations AS (
    SELECT DISTINCT crp.comp_id, crp.channel, crp.taxonomy_code, cp.property_name
    FROM revenue.competitor_rate_plans crp
    JOIN revenue.competitor_property cp ON cp.comp_id = crp.comp_id
    WHERE crp.agent_run_id = p_run_id AND crp.scrape_status = 'success'
      AND crp.taxonomy_code IS NOT NULL AND crp.taxonomy_code != 'unknown' AND NOT cp.is_self
  ),
  first_appearances AS (
    SELECT no.comp_id, no.channel, no.taxonomy_code, no.property_name
    FROM new_observations no
    WHERE NOT EXISTS (
      SELECT 1 FROM revenue.competitor_rate_plans prior
      WHERE prior.comp_id = no.comp_id AND prior.channel = no.channel 
        AND prior.taxonomy_code = no.taxonomy_code
        AND prior.shop_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 1
    )
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel, taxonomy_code,
    detected_by_run_id, severity, flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, fa.comp_id, fa.property_name, fa.channel, fa.taxonomy_code,
    p_run_id, fr.severity_default,
    fa.property_name || ' launched new plan: ' || t.display_name || ' on ' || fa.channel,
    fr.suggested_action, fr.action_text
  FROM first_appearances fa
  JOIN revenue.rate_plan_taxonomy t ON t.taxonomy_code = fa.taxonomy_code
  CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'plan_new_appearance'
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = fa.comp_id 
        AND f.channel = fa.channel AND f.taxonomy_code = fa.taxonomy_code
        AND f.detected_at >= CURRENT_DATE - 7);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  -- plan_disappearance: was there last week, not this week
  WITH last_week_plans AS (
    SELECT DISTINCT crp.comp_id, crp.channel, crp.taxonomy_code, cp.property_name
    FROM revenue.competitor_rate_plans crp
    JOIN revenue.competitor_property cp ON cp.comp_id = crp.comp_id
    WHERE crp.shop_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8
      AND crp.scrape_status = 'success' AND NOT cp.is_self
  ),
  this_week_plans AS (
    SELECT DISTINCT comp_id, channel, taxonomy_code
    FROM revenue.competitor_rate_plans
    WHERE shop_date >= CURRENT_DATE - 7 AND scrape_status = 'success'
  ),
  disappeared AS (
    SELECT lwp.* FROM last_week_plans lwp
    WHERE NOT EXISTS (
      SELECT 1 FROM this_week_plans twp 
      WHERE twp.comp_id = lwp.comp_id AND twp.channel = lwp.channel 
        AND twp.taxonomy_code = lwp.taxonomy_code
    )
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel, taxonomy_code,
    detected_by_run_id, severity, flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, d.comp_id, d.property_name, d.channel, d.taxonomy_code,
    p_run_id, fr.severity_default,
    d.property_name || ' removed plan: ' || t.display_name || ' on ' || d.channel,
    fr.suggested_action, fr.action_text
  FROM disappeared d
  JOIN revenue.rate_plan_taxonomy t ON t.taxonomy_code = d.taxonomy_code
  CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'plan_disappearance'
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = d.comp_id 
        AND f.channel = d.channel AND f.taxonomy_code = d.taxonomy_code
        AND f.detected_at >= CURRENT_DATE - 7);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  -- plan_gap_high_coverage: 50%+ comps offer plan, we don't
  -- Uses rate_plan_gaps view (already deterministic)
  INSERT INTO revenue.flags (
    rule_id, rule_code, taxonomy_code, detected_by_run_id,
    observed_value, severity, flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, g.taxonomy_code, p_run_id,
    g.comp_coverage_pct, fr.severity_default,
    g.comp_coverage_pct || '% of comps offer ' || g.plan_name || ' — we do not (avg discount ' 
      || COALESCE(g.avg_discount::text, '0') || '%)',
    fr.suggested_action, fr.action_text
  FROM revenue.rate_plan_gaps g
  CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'plan_gap_high_coverage'
    AND g.comp_coverage_pct >= 50
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.taxonomy_code = g.taxonomy_code
        AND f.detected_at >= CURRENT_DATE - 7);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  RETURN v_total;
END $$;

-- ============================================================
-- DETECTOR: promo dimension
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.fn_detect_promo_flags(p_run_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0; v_total INT := 0;
BEGIN
  -- promo_started_aggressive: new promo with discount >= 20%
  WITH new_promos AS (
    SELECT DISTINCT crp.comp_id, crp.channel, crp.stay_date, crp.discount_pct, cp.property_name
    FROM revenue.competitor_rate_plans crp
    JOIN revenue.competitor_property cp ON cp.comp_id = crp.comp_id
    WHERE crp.agent_run_id = p_run_id AND crp.has_strikethrough = true
      AND crp.discount_pct >= 20 AND NOT cp.is_self
  ),
  newly_aggressive AS (
    SELECT np.* FROM new_promos np
    WHERE NOT EXISTS (
      SELECT 1 FROM revenue.competitor_rate_plans prior
      WHERE prior.comp_id = np.comp_id AND prior.channel = np.channel
        AND prior.stay_date = np.stay_date AND prior.has_strikethrough = true
        AND prior.discount_pct >= 20 AND prior.shop_date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE - 1
    )
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel, stay_date,
    detected_by_run_id, observed_value, severity, event_context, is_event_escalated,
    flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, na.comp_id, na.property_name, na.channel, na.stay_date,
    p_run_id, na.discount_pct,
    CASE WHEN fr.escalate_on_event AND array_length(revenue.fn_event_context(na.stay_date),1)>0
         THEN revenue.fn_escalate_severity(fr.severity_default) ELSE fr.severity_default END,
    revenue.fn_event_context(na.stay_date),
    (fr.escalate_on_event AND array_length(revenue.fn_event_context(na.stay_date),1)>0),
    na.property_name || ' started ' || na.discount_pct || '% promo on ' || na.channel 
      || ' for ' || na.stay_date::text,
    fr.suggested_action, fr.action_text
  FROM newly_aggressive na CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'promo_started_aggressive'
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = na.comp_id 
        AND f.channel = na.channel AND f.stay_date = na.stay_date
        AND f.detected_at >= CURRENT_DATE);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  RETURN v_total;
END $$;

-- ============================================================
-- DETECTOR: ranking dimension
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.fn_detect_ranking_flags(p_run_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0; v_total INT := 0;
BEGIN
  -- ranking_drop_significant: 3+ position drop vs last week
  WITH this_run AS (
    SELECT cpr.comp_id, cpr.channel, cpr.search_destination, cpr.sort_order,
           cpr.position, cpr.shop_date, cp.property_name
    FROM revenue.competitor_platform_rankings cpr
    JOIN revenue.competitor_property cp ON cp.comp_id = cpr.comp_id
    WHERE cpr.agent_run_id = p_run_id
  ),
  last_week AS (
    SELECT DISTINCT ON (comp_id, channel, search_destination, sort_order)
      comp_id, channel, search_destination, sort_order, position AS prev_pos
    FROM revenue.competitor_platform_rankings
    WHERE shop_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 6
    ORDER BY comp_id, channel, search_destination, sort_order, shop_date DESC
  ),
  drops AS (
    SELECT tr.*, lw.prev_pos, (tr.position - lw.prev_pos) AS positions_lost
    FROM this_run tr 
    JOIN last_week lw USING (comp_id, channel, search_destination, sort_order)
    WHERE (tr.position - lw.prev_pos) >= 3
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel,
    detected_by_run_id, observed_value, baseline_value, delta_value,
    severity, flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, d.comp_id, d.property_name, d.channel,
    p_run_id, d.position, d.prev_pos, d.positions_lost, fr.severity_default,
    d.property_name || ' dropped ' || d.positions_lost || ' positions on ' 
      || d.channel || ' (' || d.sort_order || '): #' || d.prev_pos || ' → #' || d.position,
    fr.suggested_action, fr.action_text
  FROM drops d CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'ranking_drop_significant'
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = d.comp_id 
        AND f.channel = d.channel
        AND f.detected_at >= CURRENT_DATE - 7);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  -- ranking_off_first_page: was page 1, now page 2+
  WITH this_run AS (
    SELECT cpr.comp_id, cpr.channel, cpr.search_destination, cpr.sort_order,
           cpr.is_first_page, cpr.position, cp.property_name
    FROM revenue.competitor_platform_rankings cpr
    JOIN revenue.competitor_property cp ON cp.comp_id = cpr.comp_id
    WHERE cpr.agent_run_id = p_run_id AND cpr.is_first_page = false
  ),
  was_on_p1 AS (
    SELECT DISTINCT ON (comp_id, channel, search_destination, sort_order)
      comp_id, channel, search_destination, sort_order
    FROM revenue.competitor_platform_rankings
    WHERE shop_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 6
      AND is_first_page = true
    ORDER BY comp_id, channel, search_destination, sort_order, shop_date DESC
  ),
  fell_off AS (
    SELECT tr.* FROM this_run tr 
    JOIN was_on_p1 wp USING (comp_id, channel, search_destination, sort_order)
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel,
    detected_by_run_id, observed_value, severity,
    flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, fo.comp_id, fo.property_name, fo.channel,
    p_run_id, fo.position, fr.severity_default,
    fo.property_name || ' fell off page 1 on ' || fo.channel 
      || ' (' || fo.sort_order || '): now #' || fo.position,
    fr.suggested_action, fr.action_text
  FROM fell_off fo CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'ranking_off_first_page'
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = fo.comp_id 
        AND f.channel = fo.channel
        AND f.detected_at >= CURRENT_DATE - 7);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  RETURN v_total;
END $$;

-- ============================================================
-- DETECTOR: reviews dimension
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.fn_detect_review_flags(p_run_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0; v_total INT := 0;
BEGIN
  -- review_score_drop: -0.3 vs 30d baseline
  WITH this_run AS (
    SELECT cr.comp_id, cr.channel, cr.review_score, cr.review_count, cp.property_name
    FROM revenue.competitor_reviews cr
    JOIN revenue.competitor_property cp ON cp.comp_id = cr.comp_id
    WHERE cr.agent_run_id = p_run_id AND cr.review_score IS NOT NULL
  ),
  baseline AS (
    SELECT cr.comp_id, cr.channel, AVG(cr.review_score) AS avg_score
    FROM revenue.competitor_reviews cr
    WHERE cr.shop_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 1
    GROUP BY cr.comp_id, cr.channel HAVING COUNT(*) >= 3
  ),
  drops AS (
    SELECT tr.*, b.avg_score, (tr.review_score - b.avg_score) AS score_change
    FROM this_run tr JOIN baseline b USING (comp_id, channel)
    WHERE (tr.review_score - b.avg_score) <= -0.3
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel,
    detected_by_run_id, observed_value, baseline_value, delta_value,
    severity, flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, d.comp_id, d.property_name, d.channel,
    p_run_id, d.review_score, d.avg_score, d.score_change, fr.severity_default,
    d.property_name || ' review score dropped on ' || d.channel || ': ' 
      || ROUND(d.avg_score::numeric, 1) || ' → ' || d.review_score,
    fr.suggested_action, fr.action_text
  FROM drops d CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'review_score_drop'
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = d.comp_id 
        AND f.channel = d.channel
        AND f.detected_at >= CURRENT_DATE - 14);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  RETURN v_total;
END $$;

-- ============================================================
-- ORCHESTRATOR: run all detectors after an agent_run completes
-- This is the single entry point Edge Function calls
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.fn_detect_all_flags(p_run_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_rate INT; v_plan INT; v_promo INT; v_ranking INT; v_review INT;
BEGIN
  v_rate    := revenue.fn_detect_rate_flags(p_run_id);
  v_plan    := revenue.fn_detect_rate_plan_flags(p_run_id);
  v_promo   := revenue.fn_detect_promo_flags(p_run_id);
  v_ranking := revenue.fn_detect_ranking_flags(p_run_id);
  v_review  := revenue.fn_detect_review_flags(p_run_id);
  
  -- Auto-expire stale flags
  UPDATE revenue.flags SET status = 'expired'
  WHERE status = 'open' AND detected_at < NOW() - INTERVAL '14 days';
  
  RETURN jsonb_build_object(
    'rate_flags', v_rate,
    'rate_plan_flags', v_plan,
    'promo_flags', v_promo,
    'ranking_flags', v_ranking,
    'review_flags', v_review,
    'total', v_rate + v_plan + v_promo + v_ranking + v_review,
    'evaluated_at', NOW()
  );
END $$;

COMMENT ON FUNCTION revenue.fn_detect_all_flags IS 'Master flag detection orchestrator. Call after each agent_run completes. Returns JSON summary of flags created per dimension.';
