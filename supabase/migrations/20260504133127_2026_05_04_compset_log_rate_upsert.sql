-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504133127
-- Name:    2026_05_04_compset_log_rate_upsert
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Replace plain INSERT with UPSERT so re-runs on same shop_date update instead of throwing.
-- Now possible because uq_comp_rates_cell is a proper named constraint (not COALESCE expr index).
-- Without this, EF crashes silently on first dup key → run stuck in 'running' status forever.

CREATE OR REPLACE FUNCTION public.compset_log_rate(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'revenue'
AS $function$
DECLARE v_id UUID;
BEGIN
  INSERT INTO revenue.competitor_rates (
    comp_id, stay_date, shop_date, channel, los_nights, geo_market,
    rate_usd, native_rate, native_currency, currency,
    is_available, is_refundable, room_type, mealplan,
    scrape_status, agent_run_id, raw, source,
    fx_source, fx_as_of_ts
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
    COALESCE(p->>'source', 'nimble'),
    p->>'fx_source',
    NULLIF(p->>'fx_as_of_ts','')::timestamptz
  )
  ON CONFLICT ON CONSTRAINT uq_comp_rates_cell DO UPDATE SET
    rate_usd       = EXCLUDED.rate_usd,
    native_rate    = EXCLUDED.native_rate,
    is_available   = EXCLUDED.is_available,
    is_refundable  = EXCLUDED.is_refundable,
    room_type      = EXCLUDED.room_type,
    scrape_status  = EXCLUDED.scrape_status,
    agent_run_id   = EXCLUDED.agent_run_id,
    raw            = EXCLUDED.raw,
    source         = EXCLUDED.source,
    fx_source      = EXCLUDED.fx_source,
    fx_as_of_ts    = EXCLUDED.fx_as_of_ts
  RETURNING rate_id INTO v_id;

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
$function$;

COMMENT ON FUNCTION public.compset_log_rate(jsonb) IS
  'UPSERT (was INSERT). Re-running agent on same shop_date updates the existing row '
  'instead of throwing dup-key. Fixes silent EF crashes 2026-05-04.';
