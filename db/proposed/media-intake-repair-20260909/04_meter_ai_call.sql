-- ============================================================================
-- ITEM 6 · Per-tenant AI metering for media QA          PBS-approved 2026-09-09
-- ============================================================================
-- WHY. public.ai_token_meter has five sources and none is media. media-qa-score
-- has never metered a single call: the 2,181 Namkhan scorings and the 25-asset
-- Donna pilot are all invisible spend. The only cost record is
-- qa-score-batch's hardcoded `cost_milli: scored_ok.length * 15` — a flat
-- $0.015/asset guess, measured at ~5.4x under (real ~$0.081/asset).
-- R3 promises per-tenant cost transparency; L17 mandates per-tenant metering.
--
-- WHY A NEW FUNCTION rather than editing one of the two that exist:
--   public.fn_record_token_use   — HAS property_id, but prices from
--       public.ai_model_rates, which has no row for claude-sonnet-4-5-20250929.
--       Its COALESCE(v_cost,0) would record every media call at cost_usd = 0.
--       Metering theatre is worse than no metering.
--   public.fn_ai_usage_report    — prices correctly from costs.price_book_rates,
--       strips the -YYYYMMDD suffix, and deliberately falls back to sonnet rates
--       instead of $0. But it has NO property_id, which is why every
--       gha-brief-builder row is property_id NULL. Adding a defaulted param
--       would create an overload and make existing 7-arg calls ambiguous
--       ("function is not unique"), breaking the brief builder.
-- So: create forward (memory 882). Nothing is dropped or altered.

CREATE OR REPLACE FUNCTION public.fn_meter_ai_call(
  p_property_id   bigint,
  p_agent_handle  text,
  p_model         text,
  p_tokens_in     bigint DEFAULT 0,
  p_tokens_cached bigint DEFAULT 0,
  p_tokens_out    bigint DEFAULT 0,
  p_source        text   DEFAULT 'unknown',
  p_run_ref       text   DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public','costs','pg_catalog'
AS $function$
DECLARE
  v_key text; v_in numeric; v_cached numeric; v_out numeric;
  v_cost numeric; v_src text := COALESCE(p_source,'unknown'); v_id bigint;
BEGIN
  -- L22: metering must name its tenant. Holding-level work passes 0 explicitly.
  IF p_property_id IS NULL THEN
    RAISE EXCEPTION 'fn_meter_ai_call: p_property_id is required (pass 0 for holding-level work), never NULL';
  END IF;

  -- Idempotent on run_ref, matching fn_ai_usage_report's contract.
  IF p_run_ref IS NOT NULL AND length(p_run_ref) > 0 THEN
    SELECT id INTO v_id FROM public.ai_token_meter WHERE run_ref = p_run_ref LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok',true,'id',v_id,'dedup',true);
    END IF;
  END IF;

  -- Normalise model to the price-book product_key: strip trailing -YYYYMMDD.
  v_key := regexp_replace(COALESCE(p_model,''), '-[0-9]{8}$', '');

  SELECT max(CASE WHEN r.unit_type='input_tokens'        THEN r.unit_price/r.unit_size END),
         max(CASE WHEN r.unit_type='cached_input_tokens' THEN r.unit_price/r.unit_size END),
         max(CASE WHEN r.unit_type='output_tokens'       THEN r.unit_price/r.unit_size END)
    INTO v_in, v_cached, v_out
  FROM costs.price_book_rates r
  JOIN costs.price_books b ON b.id = r.price_book_id
  JOIN costs.providers  pr ON pr.id = b.provider_id AND pr.provider_key = 'anthropic'
  WHERE r.product_key = v_key;

  IF v_in IS NULL THEN
    -- Unknown model: estimate at sonnet rates rather than record $0.
    -- Blindness is the disease (inherited from fn_ai_usage_report).
    SELECT max(CASE WHEN r.unit_type='input_tokens'        THEN r.unit_price/r.unit_size END),
           max(CASE WHEN r.unit_type='cached_input_tokens' THEN r.unit_price/r.unit_size END),
           max(CASE WHEN r.unit_type='output_tokens'       THEN r.unit_price/r.unit_size END)
      INTO v_in, v_cached, v_out
    FROM costs.price_book_rates r WHERE r.product_key = 'claude-sonnet-4-5';
    v_src := v_src || ':rate-fallback';
  END IF;

  v_cost := round( COALESCE(p_tokens_in,0)     * COALESCE(v_in,0)
                 + COALESCE(p_tokens_cached,0) * COALESCE(v_cached,0)
                 + COALESCE(p_tokens_out,0)    * COALESCE(v_out,0), 6);

  INSERT INTO public.ai_token_meter
    (property_id, agent_handle, model, tokens_in, tokens_out, cost_usd, source, run_ref)
  VALUES
    (NULLIF(p_property_id,0), p_agent_handle, COALESCE(p_model,'claude'),
     COALESCE(p_tokens_in,0) + COALESCE(p_tokens_cached,0),
     COALESCE(p_tokens_out,0), v_cost, v_src, p_run_ref)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'cost_usd',v_cost,'source',v_src);
END $function$;

REVOKE ALL ON FUNCTION public.fn_meter_ai_call(bigint,text,text,bigint,bigint,bigint,text,text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_meter_ai_call(bigint,text,text,bigint,bigint,bigint,text,text) TO authenticated, service_role;
