-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504195018
-- Name:    2026_05_04_parity_promo_context
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Refine parity description: include the promo context so the rev manager
-- sees WHY refundable came in cheaper.
CREATE OR REPLACE FUNCTION public.parity_check_internal()
RETURNS TABLE (out_run_id uuid, out_breaches_inserted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'revenue', 'governance'
AS $function$
DECLARE
  v_run_id     uuid;
  v_inserted   int := 0;
  v_agent_id   uuid;
  v_warn_pct   numeric := 10;
  v_alert_pct  numeric := 25;
BEGIN
  SELECT a.agent_id,
         COALESCE((a.runtime_settings->>'rate_jump_warn_pct')::numeric, 10),
         COALESCE((a.runtime_settings->>'rate_jump_alert_pct')::numeric, 25)
    INTO v_agent_id, v_warn_pct, v_alert_pct
  FROM governance.agents a WHERE a.code = 'parity_agent';
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'parity_agent not registered'; END IF;

  v_run_id := public.compset_run_create(
    jsonb_build_object('mode','internal_bdc','agent','parity_agent','triggered_at',now())
  );
  UPDATE governance.agent_runs ar SET agent_id = v_agent_id WHERE ar.run_id = v_run_id;

  INSERT INTO revenue.parity_observations
    (comp_id, shop_date, stay_date, channel, raw_room_type, raw_label,
     rate_usd, is_refundable, meal_plan, agent_run_id)
  SELECT cp.comp_id, vp.shop_date, vp.stay_date, vp.channel,
         vp.raw_room_type, vp.raw_label,
         vp.rate_usd, vp.is_refundable, vp.meal_plan, v_run_id
  FROM public.v_compset_rate_plans_latest vp
  JOIN revenue.competitor_property cp ON cp.comp_id = vp.comp_id
  WHERE cp.is_self = true;

  WITH plans AS (
    SELECT vp.* FROM public.v_compset_rate_plans_latest vp
    JOIN revenue.competitor_property cp ON cp.comp_id = vp.comp_id
    WHERE cp.is_self = true
  ),
  pairs AS (
    SELECT
      r.comp_id, r.shop_date, r.stay_date, r.raw_room_type, r.channel,
      r.rate_usd AS refund_rate, r.raw_label AS refund_label, r.promo_label AS refund_promo,
      n.rate_usd AS nonref_rate, n.raw_label AS nonref_label, n.promo_label AS nonref_promo
    FROM plans r
    JOIN plans n
      ON n.comp_id = r.comp_id AND n.stay_date = r.stay_date
     AND n.channel = r.channel AND n.raw_room_type = r.raw_room_type
    WHERE r.is_refundable = true AND n.is_refundable = false
      AND n.rate_usd > r.rate_usd
  )
  INSERT INTO revenue.parity_breaches
    (comp_id, shop_date, stay_date, severity, rule_code, rule_description,
     channel_a, channel_b, rate_a_usd, rate_b_usd, delta_usd, delta_pct,
     raw_room_type, raw_label_a, raw_label_b, agent_run_id)
  SELECT comp_id, shop_date, stay_date, 'critical', 'NONREFUND_GT_REFUND',
         CASE
           WHEN refund_promo IS NOT NULL AND nonref_promo IS NULL THEN
             'Refundable rate has "' || refund_promo || '" promo applied — non-refundable doesn''t. Result: non-ref ends up MORE expensive than refundable. Either extend the promo to non-refund, or withdraw non-refund during promo windows.'
           WHEN refund_promo IS NULL AND nonref_promo IS NULL THEN
             'Non-refundable plan priced higher than refundable for same room — likely a Cloudbeds rate-plan config error. Should always be cheaper.'
           ELSE
             'Non-refundable plan priced higher than refundable for same room. Refund-promo: ' || COALESCE(refund_promo,'none') || ' · Non-ref-promo: ' || COALESCE(nonref_promo,'none') || '.'
         END,
         channel, channel, refund_rate, nonref_rate,
         nonref_rate - refund_rate,
         ROUND(((nonref_rate - refund_rate) / NULLIF(refund_rate,0)) * 100, 1),
         raw_room_type, refund_label, nonref_label, v_run_id
  FROM pairs;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- DoD jump rule unchanged
  WITH today AS (
    SELECT po.comp_id, po.stay_date, po.channel, po.raw_label,
           po.raw_room_type, po.rate_usd, po.shop_date
    FROM revenue.parity_observations po
    WHERE po.shop_date = (SELECT MAX(po2.shop_date) FROM revenue.parity_observations po2)
  ),
  yesterday AS (
    SELECT DISTINCT ON (po.comp_id, po.stay_date, po.channel, po.raw_label)
           po.comp_id, po.stay_date, po.channel, po.raw_label, po.rate_usd, po.shop_date
    FROM revenue.parity_observations po
    WHERE po.shop_date < (SELECT MAX(po2.shop_date) FROM revenue.parity_observations po2)
    ORDER BY po.comp_id, po.stay_date, po.channel, po.raw_label, po.shop_date DESC
  ),
  jumps AS (
    SELECT t.comp_id, t.shop_date, t.stay_date, t.channel, t.raw_room_type, t.raw_label,
           y.rate_usd AS prior_rate, t.rate_usd AS new_rate,
           t.rate_usd - y.rate_usd AS delta_usd,
           ROUND(((t.rate_usd - y.rate_usd) / NULLIF(y.rate_usd, 0)) * 100, 1) AS delta_pct
    FROM today t
    JOIN yesterday y
      ON y.comp_id = t.comp_id AND y.stay_date = t.stay_date
     AND y.channel = t.channel AND y.raw_label = t.raw_label
    WHERE ABS(t.rate_usd - y.rate_usd) > 0
      AND ABS(((t.rate_usd - y.rate_usd) / NULLIF(y.rate_usd, 0)) * 100) >= v_warn_pct
  )
  INSERT INTO revenue.parity_breaches
    (comp_id, shop_date, stay_date, severity, rule_code, rule_description,
     channel_a, rate_a_usd, rate_b_usd, delta_usd, delta_pct,
     raw_room_type, raw_label_a, agent_run_id)
  SELECT comp_id, shop_date, stay_date,
         CASE WHEN ABS(delta_pct) >= v_alert_pct THEN 'medium' ELSE 'low' END,
         'RATE_JUMP_DOD',
         'Rate moved >' || v_warn_pct || '% vs prior shop_date for the same plan.',
         channel, prior_rate, new_rate, delta_usd, delta_pct,
         raw_room_type, raw_label, v_run_id
  FROM jumps;

  UPDATE governance.agent_runs ar
  SET status = 'success', finished_at = now(), duration_ms = 0, cost_usd = 0,
      output = jsonb_build_object('mode','internal_bdc','breaches_inserted', v_inserted)
  WHERE ar.run_id = v_run_id;

  RETURN QUERY SELECT v_run_id, v_inserted;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.parity_check_internal() TO service_role, authenticated;

-- Re-run with the contextual descriptions
DELETE FROM revenue.parity_breaches WHERE NOT resolved;
SELECT * FROM public.parity_check_internal();
