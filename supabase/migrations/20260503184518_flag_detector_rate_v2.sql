-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503184518
-- Name:    flag_detector_rate_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION revenue.fn_detect_rate_flags(p_run_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_self_id UUID;
  v_count INT := 0;
  v_total INT := 0;
BEGIN
  SELECT comp_id INTO v_self_id FROM revenue.competitor_property WHERE is_self = true LIMIT 1;
  
  -- Rule: rate_comp_drop_significant (-10%) and rate_comp_drop_aggressive (-20%)
  WITH new_rates AS (
    SELECT cr.comp_id, cr.channel, cr.stay_date, cr.rate_usd, cr.shop_date, cp.property_name
    FROM revenue.competitor_rates cr
    JOIN revenue.competitor_property cp ON cp.comp_id = cr.comp_id
    WHERE cr.agent_run_id = p_run_id AND cr.scrape_status = 'success'
      AND cr.rate_usd IS NOT NULL AND NOT cp.is_self
  ),
  baselines AS (
    SELECT nr.*, AVG(prior.rate_usd) AS baseline_avg, COUNT(prior.rate_usd) AS prior_n
    FROM new_rates nr
    LEFT JOIN revenue.competitor_rates prior 
      ON prior.comp_id = nr.comp_id AND prior.channel = nr.channel
      AND prior.stay_date = nr.stay_date
      AND prior.shop_date BETWEEN nr.shop_date - 14 AND nr.shop_date - 1
      AND prior.scrape_status = 'success' AND prior.rate_usd IS NOT NULL
    GROUP BY nr.comp_id, nr.channel, nr.stay_date, nr.rate_usd, nr.shop_date, nr.property_name
  ),
  drops AS (
    SELECT comp_id, channel, stay_date, rate_usd, property_name, baseline_avg,
      ROUND(((rate_usd - baseline_avg) / baseline_avg * 100)::numeric, 1) AS pct_change
    FROM baselines WHERE prior_n >= 3 AND baseline_avg > 0
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel, stay_date,
    detected_by_run_id, observed_value, baseline_value, delta_value, delta_pct,
    severity, event_context, is_event_escalated, flag_label, suggested_action, action_text
  )
  SELECT 
    fr.rule_id, fr.rule_code, d.comp_id, d.property_name, d.channel, d.stay_date,
    p_run_id, d.rate_usd, d.baseline_avg, (d.rate_usd - d.baseline_avg), d.pct_change,
    CASE WHEN fr.escalate_on_event AND array_length(revenue.fn_event_context(d.stay_date), 1) > 0
         THEN revenue.fn_escalate_severity(fr.severity_default) ELSE fr.severity_default END,
    revenue.fn_event_context(d.stay_date),
    (fr.escalate_on_event AND array_length(revenue.fn_event_context(d.stay_date), 1) > 0),
    d.property_name || ' dropped ' || ABS(d.pct_change) || '% on ' || d.channel 
      || ' for ' || d.stay_date::text || ' (vs 14d avg $' || ROUND(d.baseline_avg::numeric,0) || ')',
    fr.suggested_action, fr.action_text
  FROM drops d
  CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true
    AND fr.rule_code IN ('rate_comp_drop_significant','rate_comp_drop_aggressive')
    AND ((fr.rule_code = 'rate_comp_drop_aggressive' AND d.pct_change <= -20)
      OR (fr.rule_code = 'rate_comp_drop_significant' AND d.pct_change <= -10 AND d.pct_change > -20))
    AND NOT EXISTS (
      SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = d.comp_id 
        AND f.channel = d.channel AND f.stay_date = d.stay_date
        AND f.detected_at >= CURRENT_DATE
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  -- Rule: rate_comp_spike (+15%)
  WITH new_rates AS (
    SELECT cr.comp_id, cr.channel, cr.stay_date, cr.rate_usd, cr.shop_date, cp.property_name
    FROM revenue.competitor_rates cr
    JOIN revenue.competitor_property cp ON cp.comp_id = cr.comp_id
    WHERE cr.agent_run_id = p_run_id AND cr.scrape_status = 'success' AND NOT cp.is_self
  ),
  spikes AS (
    SELECT nr.comp_id, nr.channel, nr.stay_date, nr.rate_usd, nr.property_name,
      AVG(prior.rate_usd) AS baseline_avg,
      ROUND(((nr.rate_usd - AVG(prior.rate_usd)) / AVG(prior.rate_usd) * 100)::numeric, 1) AS pct_change
    FROM new_rates nr
    JOIN revenue.competitor_rates prior 
      ON prior.comp_id = nr.comp_id AND prior.channel = nr.channel AND prior.stay_date = nr.stay_date
      AND prior.shop_date BETWEEN nr.shop_date - 14 AND nr.shop_date - 1
      AND prior.scrape_status = 'success'
    GROUP BY nr.comp_id, nr.channel, nr.stay_date, nr.rate_usd, nr.property_name
    HAVING COUNT(*) >= 3 AND AVG(prior.rate_usd) > 0
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel, stay_date,
    detected_by_run_id, observed_value, baseline_value, delta_value, delta_pct,
    severity, event_context, is_event_escalated, flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, s.comp_id, s.property_name, s.channel, s.stay_date,
    p_run_id, s.rate_usd, s.baseline_avg, (s.rate_usd - s.baseline_avg), s.pct_change,
    CASE WHEN fr.escalate_on_event AND array_length(revenue.fn_event_context(s.stay_date),1)>0
         THEN revenue.fn_escalate_severity(fr.severity_default) ELSE fr.severity_default END,
    revenue.fn_event_context(s.stay_date),
    (fr.escalate_on_event AND array_length(revenue.fn_event_context(s.stay_date),1)>0),
    s.property_name || ' raised ' || s.pct_change || '% on ' || s.channel 
      || ' for ' || s.stay_date::text || ' (vs 14d avg $' || ROUND(s.baseline_avg::numeric,0) || ')',
    fr.suggested_action, fr.action_text
  FROM spikes s CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'rate_comp_spike' AND s.pct_change >= 15
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = s.comp_id 
        AND f.channel = s.channel AND f.stay_date = s.stay_date
        AND f.detected_at >= CURRENT_DATE);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  -- Rule: rate_we_below_median_far / rate_we_above_median_far
  WITH self_rates AS (
    SELECT cr.stay_date, cr.channel, cr.rate_usd AS our_rate
    FROM revenue.competitor_rates cr
    WHERE cr.agent_run_id = p_run_id AND cr.comp_id = v_self_id 
      AND cr.scrape_status = 'success' AND cr.rate_usd IS NOT NULL
  ),
  comp_medians AS (
    SELECT cr.stay_date, cr.channel,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cr.rate_usd) AS median_rate
    FROM revenue.competitor_rates cr
    JOIN revenue.competitor_property cp ON cp.comp_id = cr.comp_id
    WHERE cr.agent_run_id = p_run_id AND cr.scrape_status = 'success' AND NOT cp.is_self
    GROUP BY cr.stay_date, cr.channel HAVING COUNT(*) >= 4
  ),
  positioning AS (
    SELECT sr.stay_date, sr.channel, sr.our_rate, cm.median_rate,
      ROUND(((sr.our_rate - cm.median_rate) / cm.median_rate * 100)::numeric, 1) AS pct_diff
    FROM self_rates sr JOIN comp_medians cm ON cm.stay_date = sr.stay_date AND cm.channel = sr.channel
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, channel, stay_date,
    detected_by_run_id, observed_value, baseline_value, delta_value, delta_pct,
    severity, event_context, is_event_escalated, flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, v_self_id, 'The Namkhan', p.channel, p.stay_date,
    p_run_id, p.our_rate, p.median_rate, (p.our_rate - p.median_rate), p.pct_diff,
    CASE WHEN fr.escalate_on_event AND array_length(revenue.fn_event_context(p.stay_date),1)>0
         THEN revenue.fn_escalate_severity(fr.severity_default) ELSE fr.severity_default END,
    revenue.fn_event_context(p.stay_date),
    (fr.escalate_on_event AND array_length(revenue.fn_event_context(p.stay_date),1)>0),
    CASE 
      WHEN fr.rule_code = 'rate_we_below_median_far' 
        THEN 'We are ' || ABS(p.pct_diff) || '% below comp median on ' || p.channel 
          || ' for ' || p.stay_date::text || ' ($' || p.our_rate || ' vs $' || ROUND(p.median_rate::numeric,0) || ')'
      ELSE 'We are +' || p.pct_diff || '% above comp median on ' || p.channel 
          || ' for ' || p.stay_date::text || ' ($' || p.our_rate || ' vs $' || ROUND(p.median_rate::numeric,0) || ')'
    END, fr.suggested_action, fr.action_text
  FROM positioning p CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true
    AND ((fr.rule_code = 'rate_we_below_median_far' AND p.pct_diff <= -15)
      OR (fr.rule_code = 'rate_we_above_median_far' AND p.pct_diff >= 20))
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.comp_id = v_self_id 
        AND f.channel = p.channel AND f.stay_date = p.stay_date
        AND f.detected_at >= CURRENT_DATE);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  -- Rule: rate_parity_break (our direct > our cheapest OTA)
  WITH our_rates AS (
    SELECT stay_date, channel, rate_usd FROM revenue.competitor_rates
    WHERE agent_run_id = p_run_id AND comp_id = v_self_id AND scrape_status = 'success'
  ),
  parity_check AS (
    SELECT direct.stay_date, direct.rate_usd AS direct_rate,
      MIN(ota.rate_usd) AS cheapest_ota_rate,
      ROUND((direct.rate_usd - MIN(ota.rate_usd))::numeric, 2) AS gap_usd
    FROM our_rates direct JOIN our_rates ota ON ota.stay_date = direct.stay_date 
      AND ota.channel IN ('booking','agoda','expedia','trip')
    WHERE direct.channel = 'direct'
    GROUP BY direct.stay_date, direct.rate_usd
    HAVING direct.rate_usd > MIN(ota.rate_usd)
  )
  INSERT INTO revenue.flags (
    rule_id, rule_code, comp_id, property_name, stay_date, detected_by_run_id,
    observed_value, baseline_value, delta_value, severity, event_context,
    flag_label, suggested_action, action_text
  )
  SELECT fr.rule_id, fr.rule_code, v_self_id, 'The Namkhan', pc.stay_date, p_run_id,
    pc.direct_rate, pc.cheapest_ota_rate, pc.gap_usd,
    fr.severity_default, revenue.fn_event_context(pc.stay_date),
    'Parity break ' || pc.stay_date::text || ': direct $' || pc.direct_rate 
      || ' > cheapest OTA $' || pc.cheapest_ota_rate || ' (gap $' || pc.gap_usd || ')',
    fr.suggested_action, fr.action_text
  FROM parity_check pc CROSS JOIN revenue.flag_rules fr
  WHERE fr.is_active = true AND fr.rule_code = 'rate_parity_break'
    AND NOT EXISTS (SELECT 1 FROM revenue.flags f 
      WHERE f.rule_code = fr.rule_code AND f.stay_date = pc.stay_date
        AND f.detected_at >= CURRENT_DATE);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  
  RETURN v_total;
END $$;
